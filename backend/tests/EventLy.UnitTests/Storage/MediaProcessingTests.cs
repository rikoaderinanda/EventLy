using EventLy.Api.Entities;
using EventLy.Api.Services;
using EventLy.Api.Storage;
using Shouldly;
using SkiaSharp;

namespace EventLy.UnitTests.Storage;

public sealed class MediaProcessingTests
{
    private static byte[] Image(int width, int height, SKEncodedImageFormat format = SKEncodedImageFormat.Jpeg)
    {
        using var bitmap = new SKBitmap(width, height);
        using (var canvas = new SKCanvas(bitmap))
        {
            canvas.Clear(SKColors.SteelBlue);
        }
        using var image = SKImage.FromBitmap(bitmap);
        using var data = image.Encode(format, 90);
        return data.ToArray();
    }

    /// <summary>Puts an APP1 segment right after the JPEG start marker, as a phone camera does.</summary>
    private static byte[] WithApp1(byte[] jpeg, byte[] payload)
    {
        var length = payload.Length + 2;
        return [.. jpeg[..2], 0xFF, 0xE1, (byte)(length >> 8), (byte)(length & 0xFF), .. payload, .. jpeg[2..]];
    }

    /// <summary>EXIF with only the orientation tag (6 = rotate 90° clockwise to show).</summary>
    private static byte[] OrientationExif(ushort orientation) =>
    [
        .. "Exif\0\0"u8.ToArray(),
        0x49, 0x49, 0x2A, 0x00, 0x08, 0x00, 0x00, 0x00, // little-endian TIFF, first IFD at 8
        0x01, 0x00,                                     // one entry
        0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, // tag 0x0112 Orientation, SHORT, count 1
        (byte)orientation, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00,                         // no next IFD
    ];

    [Fact]
    public void A_large_photo_is_scaled_to_2048_and_gets_a_thumbnail()
    {
        var result = ImageProcessor.Process(Image(4000, 3000)).ShouldNotBeNull();

        (result.Width, result.Height).ShouldBe((2048, 1536));
        using var thumb = SKBitmap.Decode(result.Thumbnail);
        Math.Max(thumb.Width, thumb.Height).ShouldBe(ImageProcessor.ThumbnailEdge);
        result.Jpeg.Take(3).ShouldBe(new byte[] { 0xFF, 0xD8, 0xFF });
    }

    [Fact]
    public void Metadata_such_as_gps_is_removed()
    {
        var phone = WithApp1(Image(800, 600), "Exif\0\0GPSLatitude=-6.2088;GPSLongitude=106.8456"u8.ToArray());

        var result = ImageProcessor.Process(phone).ShouldNotBeNull();

        var text = System.Text.Encoding.Latin1.GetString(result.Jpeg);
        text.ShouldNotContain("Exif");
        text.ShouldNotContain("GPS");
    }

    [Fact]
    public void The_exif_orientation_is_applied_to_the_pixels()
    {
        var sideways = WithApp1(Image(400, 200), OrientationExif(6));

        var result = ImageProcessor.Process(sideways).ShouldNotBeNull();

        (result.Width, result.Height).ShouldBe((200, 400));
    }

    [Fact]
    public void Png_and_webp_become_jpeg()
    {
        ImageProcessor.Process(Image(300, 200, SKEncodedImageFormat.Png)).ShouldNotBeNull().Jpeg[0].ShouldBe((byte)0xFF);
        ImageProcessor.Process(Image(300, 200, SKEncodedImageFormat.Webp)).ShouldNotBeNull().Jpeg[0].ShouldBe((byte)0xFF);
    }

    [Theory]
    [InlineData("not an image")]
    [InlineData("GIF89a......")]
    [InlineData("<svg xmlns='http://www.w3.org/2000/svg'/>")]
    public void Anything_else_is_refused(string content) =>
        ImageProcessor.Process(System.Text.Encoding.UTF8.GetBytes(content)).ShouldBeNull();

    [Fact]
    public void A_file_that_only_starts_like_a_jpeg_is_refused() =>
        ImageProcessor.Process([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4, 5, 6]).ShouldBeNull();

    [Fact]
    public void Music_is_mp3_or_m4a_by_its_first_bytes()
    {
        byte[] id3 = [.. "ID3"u8.ToArray(), 4, 0, 0, 0, 0, 0, 0, 0, 0];
        byte[] frame = [0xFF, 0xFB, 0x90, 0x64, 0, 0, 0, 0, 0, 0, 0, 0];
        byte[] m4a = [0, 0, 0, 0x20, .. "ftypM4A "u8.ToArray(), 0, 0, 0, 0];
        byte[] wav = [.. "RIFF"u8.ToArray(), 0, 0, 0, 0, .. "WAVE"u8.ToArray()];

        AudioCheck.Detect(id3).ShouldBe(("audio/mpeg", "mp3"));
        AudioCheck.Detect(frame).ShouldBe(("audio/mpeg", "mp3"));
        AudioCheck.Detect(m4a).ShouldBe(("audio/mp4", "m4a"));
        AudioCheck.Detect(wav).ShouldBeNull();
    }

    [Theory]
    [InlineData("Asia/Jakarta", "2026-12-12T03:00:00Z", "2026-12-12T17:00:00Z")]  // midnight WIB = 17:00 UTC
    [InlineData("Asia/Jayapura", "2026-12-12T03:00:00Z", "2026-12-12T15:00:00Z")] // midnight WIT = 15:00 UTC
    public void The_guest_camera_closes_at_midnight_after_the_event_day(string timeZone, string start, string closes)
    {
        var ev = new Event { Name = "x", TimeZone = timeZone };
        ev.Sessions.Add(new EventSession
        {
            Name = "Resepsi",
            Venue = "Gedung",
            IsCheckInSession = true,
            StartsAt = DateTimeOffset.Parse(start, System.Globalization.CultureInfo.InvariantCulture),
        });

        PhotoService.CameraClosesAt(ev).ShouldBe(DateTimeOffset.Parse(closes, System.Globalization.CultureInfo.InvariantCulture));
    }
}
