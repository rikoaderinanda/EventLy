using System.IO.Compression;
using System.Net;
using System.Net.Http.Headers;
using EventLy.Api.Data.Seed;
using EventLy.Api.Dtos.CheckIns;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Dtos.Guests;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Dtos.Photos;
using EventLy.Api.Dtos.Public;
using EventLy.Api.Entities;
using EventLy.IntegrationTests.Infrastructure;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Shouldly;
using static EventLy.IntegrationTests.Infrastructure.AuthClient;
using static EventLy.IntegrationTests.Infrastructure.GuestRequests;
using static EventLy.IntegrationTests.Infrastructure.PaymentRequests;
using static EventLy.IntegrationTests.Infrastructure.TenantBuilder;
using Events = EventLy.IntegrationTests.Infrastructure.EventRequests;

namespace EventLy.IntegrationTests;

/// <summary>
/// Photos (docs/architecture/01-system-architecture.md §6.4/§6.5): Staff upload after check-in, guest
/// camera within its limits and time window, the guest gallery, the organizer gallery, ZIP, quotas, media.
/// </summary>
public sealed class PhotosTests(PostgresFixture postgres) : IClassFixture<PostgresFixture>, IAsyncLifetime
{
    private static readonly TimeZoneInfo Jakarta = TimeZoneInfo.FindSystemTimeZoneById("Asia/Jakarta");

    private ApiFactory _factory = null!;
    private HttpClient _client = null!;
    private Tenant _tenant = null!;

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public async ValueTask InitializeAsync()
    {
        postgres.SkipIfUnavailable();
        _factory = new ApiFactory(postgres.ConnectionString);
        // Downloads answer 302 to a signed storage URL; the test checks the redirect instead of following it.
        _client = _factory.CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false });
        _tenant = await CreateTenantAsync(_client, "Foto WO");
    }

    public async ValueTask DisposeAsync()
    {
        _client?.Dispose();
        if (_factory is not null)
        {
            await _factory.DisposeAsync();
        }
    }

    private Task<HttpResponseMessage> Send(HttpMethod method, string path, Member member, object? body = null) =>
        SendAsync(_client, method, path, member.AccessToken, body);

    private Task<HttpResponseMessage> Upload(string path, string? token, params byte[][] files)
    {
        var content = new MultipartFormDataContent();
        foreach (var (file, i) in files.Select((f, i) => (f, i)))
        {
            var part = new ByteArrayContent(file);
            part.Headers.ContentType = new MediaTypeHeaderValue("image/jpeg");
            content.Add(part, files.Length == 1 && path.Contains("/public/", StringComparison.Ordinal) ? "file" : "files", $"foto{i}.jpg");
        }
        var request = new HttpRequestMessage(HttpMethod.Post, path) { Content = content };
        if (token is not null)
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
        }
        return _client.SendAsync(request, Ct);
    }

    private async Task<PackageDto> PackageAsync(Action<PackageFeatures> change)
    {
        var root = (await DevSignInAsync(_client, ApiFactory.RootEmail)).Body.AccessToken;
        var features = PackageSeed.Initial()[1].Features.Copy(); // Premium: guest camera 5, ZIP
        change(features);
        return await ReadAsync<PackageDto>(await SendAsync(_client, HttpMethod.Post, "/api/v1/platform/packages", root,
            new CreatePackageRequest("F" + Guid.NewGuid().ToString("N")[..10], "Foto", 100_000m, "IDR", features, true)));
    }

    /// <summary>A paid event today (Jakarta) with Staff assigned and one checked-in guest.</summary>
    private async Task<(EventDto Event, GuestDto Guest)> CheckedInGuestAsync(Action<PackageFeatures>? package = null)
    {
        var today = TimeZoneInfo.ConvertTime(_factory.Time.GetUtcNow(), Jakarta).Date;
        var ev = await Events.CreateAsync(_client, _tenant.Owner, new CreateEventRequest("Resepsi Foto", EventCategory.Wedding,
            "Asia/Jakarta", null, [new EventSessionInput(null, "Resepsi", today.AddMinutes(1), today.AddHours(23).AddMinutes(58), "Gedung", null, true)]));
        var chosen = await PackageAsync(package ?? (_ => { }));
        await PayAsync(_factory, _client, await StartCheckoutAsync(_client, _tenant.Owner, ev.Id, chosen.Id));
        (await Send(HttpMethod.Put, $"/api/v1/events/{ev.Id}/staff", _tenant.Owner,
            new AssignStaffRequest([_tenant.Staff.UserId]))).EnsureSuccessStatusCode();
        var guest = await CreateAsync(_client, _tenant.Owner, ev.Id);
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Staff,
            new CheckInRequest(guest.Invitation.Code, null))).EnsureSuccessStatusCode();
        return (ev, guest);
    }

    private string GuestPath(GuestDto guest, string path = "") => $"/api/v1/public/invitations/{guest.Invitation.Code}{path}";

    [Fact]
    public async Task Staff_upload_photos_after_check_in_cleaned_and_resized()
    {
        var (ev, guest) = await CheckedInGuestAsync();

        var response = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Staff.AccessToken,
            TestImages.Jpeg(4000, 3000), TestImages.JpegWithGps());

        response.StatusCode.ShouldBe(HttpStatusCode.Created);
        var photos = await ReadAsync<List<PhotoDto>>(response);
        photos.Count.ShouldBe(2);
        photos.ShouldAllBe(p => p.Source == PhotoSource.Staff && p.GuestName == guest.Name);
        (photos[0].Width, photos[0].Height).ShouldBe((2048, 1536));
        var key = FakeFileStorage.KeyOf(photos[1].Url);
        key.ShouldBe($"org/{_tenant.OrganizationId}/event/{ev.Id}/inv/{guest.Invitation.Id}/{photos[1].Id}.jpg");
        var stored = System.Text.Encoding.Latin1.GetString(_factory.Storage.Objects[key].Content);
        stored.ShouldNotContain("GPS");
        _factory.Storage.Objects.ShouldContainKey(FakeFileStorage.KeyOf(photos[1].ThumbnailUrl));
        await using var db = postgres.CreateDbContext(_tenant.OrganizationId);
        (await db.AuditLogs.CountAsync(a => a.Action == AuditActions.PhotoUploaded && a.EntityId == photos[0].Id, Ct)).ShouldBe(1);
    }

    [Fact]
    public async Task Uploads_need_a_checked_in_guest_an_image_and_the_right_role()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        var waiting = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Belum datang"));
        var other = await CreateTenantAsync(_client, "Lain WO");

        var notCheckedIn = await Upload($"/api/v1/invitations/{waiting.Invitation.Id}/photos", _tenant.Staff.AccessToken, TestImages.Jpeg());
        var notImage = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Staff.AccessToken, "bukan gambar"u8.ToArray());
        var admin = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Admin.AccessToken, TestImages.Jpeg());
        var otherTenant = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", other.Owner.AccessToken, TestImages.Jpeg());
        var owner = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Owner.AccessToken, TestImages.Png());

        notCheckedIn.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(notCheckedIn)).ShouldBe("photo.not_checked_in");
        notImage.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemCodeAsync(notImage)).ShouldBe("photo.invalid_image");
        admin.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        otherTenant.StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await ReadAsync<List<PhotoDto>>(owner)).Single().Source.ShouldBe(PhotoSource.Owner);
    }

    [Fact]
    public async Task The_package_photo_limit_is_a_422_and_nothing_is_left_behind()
    {
        var (ev, guest) = await CheckedInGuestAsync(f => f.MaxPhotos = 2);
        var before = _factory.Storage.Objects.Count;

        var response = await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Staff.AccessToken,
            TestImages.Jpeg(), TestImages.Jpeg(), TestImages.Jpeg());

        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await ProblemCodeAsync(response)).ShouldBe("photo.quota_exceeded");
        _factory.Storage.Objects.Count.ShouldBe(before);
        (await ReadAsync<GalleryDto>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gallery", _tenant.Owner))).Total.ShouldBe(0);
    }

    [Fact]
    public async Task The_organizer_sees_downloads_and_deletes_photos()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        var photo = (await ReadAsync<List<PhotoDto>>(await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos",
            _tenant.Staff.AccessToken, TestImages.Jpeg()))).Single();

        var gallery = await ReadAsync<GalleryDto>(await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gallery", _tenant.Admin));
        var download = await Send(HttpMethod.Get, $"/api/v1/photos/{photo.Id}/download", _tenant.Admin);
        var delete = await Send(HttpMethod.Delete, $"/api/v1/photos/{photo.Id}", _tenant.Admin);

        gallery.Photos.ShouldHaveSingleItem().GuestName.ShouldBe(guest.Name);
        gallery.Total.ShouldBe(1);
        gallery.Limit.ShouldBe(PackageSeed.Initial()[1].Features.MaxPhotos);
        gallery.StorageBytes.ShouldBeGreaterThan(0);
        download.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        download.Headers.Location!.ToString().ShouldContain("download=");
        delete.StatusCode.ShouldBe(HttpStatusCode.NoContent);
        _factory.Storage.Objects.ShouldNotContainKey(FakeFileStorage.KeyOf(photo.Url));
        _factory.Storage.Objects.ShouldNotContainKey(FakeFileStorage.KeyOf(photo.ThumbnailUrl));
        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gallery", _tenant.Staff)).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task The_gallery_downloads_as_a_zip_when_the_package_allows_it()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Staff.AccessToken, TestImages.Jpeg(), TestImages.Jpeg());
        var (noZipEvent, _) = await CheckedInGuestAsync(f => f.ZipDownload = false);

        var zip = await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gallery/zip", _tenant.Owner);
        var refused = await Send(HttpMethod.Get, $"/api/v1/events/{noZipEvent.Id}/gallery/zip", _tenant.Owner);

        zip.Content.Headers.ContentType!.MediaType.ShouldBe("application/zip");
        using var archive = new ZipArchive(await zip.Content.ReadAsStreamAsync(Ct));
        archive.Entries.Select(e => e.FullName).ShouldBe([$"{guest.Name}/001.jpg", $"{guest.Name}/002.jpg"]);
        refused.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(refused)).ShouldBe("photo.zip_not_in_package");
    }

    [Fact]
    public async Task The_guest_gallery_opens_after_check_in_and_shows_only_their_photos()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        var other = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Tamu lain"));
        (await Send(HttpMethod.Post, $"/api/v1/events/{ev.Id}/check-ins", _tenant.Staff,
            new CheckInRequest(other.Invitation.Code, null))).EnsureSuccessStatusCode();
        var waiting = await CreateAsync(_client, _tenant.Owner, ev.Id, Individual("Belum datang"));
        await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos", _tenant.Staff.AccessToken, TestImages.Jpeg());
        var otherPhoto = (await ReadAsync<List<PhotoDto>>(await Upload($"/api/v1/invitations/{other.Invitation.Id}/photos",
            _tenant.Staff.AccessToken, TestImages.Jpeg()))).Single();

        var locked = await SendAsync(_client, HttpMethod.Get, GuestPath(waiting, "/gallery"), null);
        var gallery = await ReadAsync<PublicGalleryDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/gallery"), null));
        var foreign = await SendAsync(_client, HttpMethod.Get, GuestPath(guest, $"/gallery/{otherPhoto.Id}/download"), null);

        locked.StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await ProblemCodeAsync(locked)).ShouldBe("gallery.locked");
        var mine = gallery.Photos.ShouldHaveSingleItem();
        mine.IsMine.ShouldBeFalse(); // taken by Staff: the guest can't delete it
        foreign.StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task The_guest_camera_takes_photos_up_to_the_package_limit()
    {
        var (_, guest) = await CheckedInGuestAsync(f => f.MaxGuestPhotosPerInvitation = 2);

        var first = await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg());
        await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg());
        var third = await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg());
        var gallery = await ReadAsync<PublicGalleryDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/gallery"), null));

        first.StatusCode.ShouldBe(HttpStatusCode.Created);
        (await ReadAsync<PublicPhotoDto>(first)).IsMine.ShouldBeTrue();
        third.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await ProblemCodeAsync(third)).ShouldBe("photo.camera_closed");
        gallery.Camera.ShouldBe(new GuestCameraDto(false, 2, 2, gallery.Camera.ClosesAt));

        // Deleting one of their own frees a place again.
        (await SendAsync(_client, HttpMethod.Delete, GuestPath(guest, $"/photos/{gallery.Photos[0].Id}"), null))
            .StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg())).StatusCode.ShouldBe(HttpStatusCode.Created);
    }

    [Fact]
    public async Task The_guest_camera_follows_the_package_the_event_switch_and_the_time()
    {
        var (_, basicGuest) = await CheckedInGuestAsync(f => f.GuestUploadEnabled = false);
        var (switchedOff, guest) = await CheckedInGuestAsync();
        var staffPhoto = (await ReadAsync<List<PhotoDto>>(await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos",
            _tenant.Staff.AccessToken, TestImages.Jpeg()))).Single();

        (await Upload(GuestPath(basicGuest, "/photos"), null, TestImages.Jpeg())).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await SendAsync(_client, HttpMethod.Delete, GuestPath(guest, $"/photos/{staffPhoto.Id}"), null))
            .StatusCode.ShouldBe(HttpStatusCode.NotFound);

        (await Send(HttpMethod.Put, $"/api/v1/events/{switchedOff.Id}/guest-camera", _tenant.Admin,
            new GuestCameraSettingRequest(false))).StatusCode.ShouldBe(HttpStatusCode.NoContent);
        (await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg())).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await Send(HttpMethod.Put, $"/api/v1/events/{switchedOff.Id}/guest-camera", _tenant.Admin,
            new GuestCameraSettingRequest(true))).EnsureSuccessStatusCode();
        (await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg())).StatusCode.ShouldBe(HttpStatusCode.Created);

        // After midnight of the event day the camera closes; the gallery stays open.
        var closes = (await ReadAsync<PublicGalleryDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/gallery"), null)))
            .Camera.ClosesAt!.Value;
        _factory.Time.Advance(closes - _factory.Time.GetUtcNow() + TimeSpan.FromMinutes(1));
        (await Upload(GuestPath(guest, "/photos"), null, TestImages.Jpeg())).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/gallery"), null)).StatusCode.ShouldBe(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Another_tenant_cant_see_or_delete_photos()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        var photo = (await ReadAsync<List<PhotoDto>>(await Upload($"/api/v1/invitations/{guest.Invitation.Id}/photos",
            _tenant.Staff.AccessToken, TestImages.Jpeg()))).Single();
        var other = await CreateTenantAsync(_client, "Lain WO");

        (await Send(HttpMethod.Get, $"/api/v1/events/{ev.Id}/gallery", other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Get, $"/api/v1/photos/{photo.Id}/download", other.Admin)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await Send(HttpMethod.Delete, $"/api/v1/photos/{photo.Id}", other.Owner)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        _factory.Storage.Objects.ShouldContainKey(FakeFileStorage.KeyOf(photo.Url));
    }

    [Fact]
    public async Task Cover_qris_and_music_show_on_the_invitation_page()
    {
        var (ev, guest) = await CheckedInGuestAsync();
        byte[] mp3 = [.. "ID3"u8.ToArray(), 4, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3];

        var cover = await UploadMedia(ev.Id, "cover", TestImages.Jpeg());
        await UploadMedia(ev.Id, "qris", TestImages.Png());
        var music = await UploadMedia(ev.Id, "music", mp3);
        var badMusic = await UploadMedia(ev.Id, "music", TestImages.Jpeg());

        cover.StatusCode.ShouldBe(HttpStatusCode.OK);
        music.StatusCode.ShouldBe(HttpStatusCode.OK);
        badMusic.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await ProblemCodeAsync(badMusic)).ShouldBe("media.invalid_audio");

        var page = await ReadAsync<PublicInvitationDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest), null));
        page.Event.CoverUrl.ShouldNotBeNull().ShouldStartWith(FakeFileStorage.UrlPrefix);
        page.Features.BackgroundMusic.ShouldBeTrue();
        (await ReadAsync<PublicGiftsDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/gifts"), null))).QrisUrl.ShouldNotBeNull();
        var musicUrl = await SendAsync(_client, HttpMethod.Get, GuestPath(guest, "/music"), null);
        musicUrl.StatusCode.ShouldBe(HttpStatusCode.Redirect);
        _factory.Storage.Objects[FakeFileStorage.KeyOf(musicUrl.Headers.Location!.ToString())].ContentType.ShouldBe("audio/mpeg");

        var removed = await ReadAsync<EventMediaDto>(await Send(HttpMethod.Delete, $"/api/v1/events/{ev.Id}/media/music", _tenant.Owner));
        removed.MusicUrl.ShouldBeNull();
        (await ReadAsync<PublicInvitationDto>(await SendAsync(_client, HttpMethod.Get, GuestPath(guest), null)))
            .Features.BackgroundMusic.ShouldBeFalse();
    }

    private Task<HttpResponseMessage> UploadMedia(Guid eventId, string kind, byte[] file)
    {
        var content = new MultipartFormDataContent { { new ByteArrayContent(file), "file", "media.bin" } };
        var request = new HttpRequestMessage(HttpMethod.Put, $"/api/v1/events/{eventId}/media/{kind}") { Content = content };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _tenant.Owner.AccessToken);
        return _client.SendAsync(request, Ct);
    }
}
