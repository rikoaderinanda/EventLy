using System.Globalization;
using FluentValidation;

namespace EventLy.Api.Common.Localization;

/// <summary>
/// Messages people read (validation errors, import rows) in the app's language: Indonesian by default,
/// English when the PWA asks for it with <c>Accept-Language: en</c>. Error codes stay the same in both;
/// the PWA translates those itself. Two languages, so the pairs live next to the rules, not in resource files.
/// </summary>
public static class Texts
{
    public static readonly CultureInfo Indonesian = CultureInfo.GetCultureInfo("id");
    public static readonly CultureInfo English = CultureInfo.GetCultureInfo("en");

    public static bool IsEnglish => CultureInfo.CurrentUICulture.TwoLetterISOLanguageName == "en";

    /// <summary>The Indonesian or the English text, for the language of the current request.</summary>
    public static string T(string indonesian, string english) => IsEnglish ? english : indonesian;

    /// <summary>Field names in FluentValidation's built-in messages ("'Nama' tidak boleh kosong.").</summary>
    private static readonly Dictionary<string, (string Id, string En)> Fields = new()
    {
        ["Name"] = ("Nama", "Name"),
        ["Email"] = ("Email", "Email"),
        ["Phone"] = ("Nomor telepon", "Phone number"),
        ["ContactEmail"] = ("Email kontak", "Contact email"),
        ["ContactPhone"] = ("Nomor telepon", "Phone number"),
        ["Description"] = ("Kata pengantar", "Description"),
        ["Category"] = ("Kategori", "Category"),
        ["TimeZone"] = ("Zona waktu", "Time zone"),
        ["Sessions"] = ("Sesi", "Sessions"),
        ["StartsAtLocal"] = ("Waktu mulai", "Start"),
        ["EndsAtLocal"] = ("Waktu selesai", "End"),
        ["Venue"] = ("Lokasi", "Venue"),
        ["MapsUrl"] = ("Link Google Maps", "Google Maps link"),
        ["NumberOfPeople"] = ("Jumlah orang", "Number of people"),
        ["GuestType"] = ("Jenis undangan", "Invitation type"),
        ["SessionIds"] = ("Sesi", "Sessions"),
        ["Template"] = ("Pesan WhatsApp", "WhatsApp message"),
        ["Message"] = ("Ucapan", "Message"),
        ["SenderName"] = ("Nama pengirim", "Sender name"),
        ["Amount"] = ("Jumlah", "Amount"),
        ["Note"] = ("Catatan", "Note"),
        ["Address"] = ("Alamat", "Address"),
        ["Accounts"] = ("Rekening", "Accounts"),
        ["Provider"] = ("Bank / e-wallet", "Bank / e-wallet"),
        ["AccountNumber"] = ("Nomor rekening", "Account number"),
        ["AccountHolder"] = ("Atas nama", "Account holder"),
        ["Code"] = ("Kode", "Code"),
        ["Price"] = ("Harga", "Price"),
        ["Currency"] = ("Mata uang", "Currency"),
        ["MaxGuests"] = ("Maks. tamu", "Max. guests"),
        ["MaxPhotos"] = ("Maks. foto", "Max. photos"),
        ["MaxStaff"] = ("Maks. Staff", "Max. staff"),
        ["MaxAdmins"] = ("Maks. Admin", "Max. admins"),
        ["GalleryRetentionDays"] = ("Lama galeri disimpan", "Gallery retention"),
        ["MaxGuestPhotosPerInvitation"] = ("Foto tamu per undangan", "Guest photos per invitation"),
        ["PackageId"] = ("Paket", "Package"),
        ["Role"] = ("Peran", "Role"),
        ["Status"] = ("Status", "Status"),
        ["UserIds"] = ("Staff", "Staff"),
        ["TermsVersion"] = ("Versi syarat", "Terms version"),
    };

    public static string? Field(string? member) =>
        member is not null && Fields.TryGetValue(member, out var name) ? T(name.Id, name.En) : member;

    /// <summary>Built-in FluentValidation messages follow the request language (it ships Indonesian), with our field names.</summary>
    public static void ConfigureValidation()
    {
        ValidatorOptions.Global.LanguageManager.Culture = null; // use CultureInfo.CurrentUICulture per request
        ValidatorOptions.Global.DisplayNameResolver = (_, member, _) => Field(member?.Name);
    }

    /// <summary>
    /// Sets only the UI culture (message language) from <c>Accept-Language</c>; number and date formatting
    /// stay as they are, so nothing else changes with the language.
    /// </summary>
    public static IApplicationBuilder UseRequestLanguage(this IApplicationBuilder app) =>
        app.Use(async (http, next) =>
        {
            var english = http.Request.GetTypedHeaders().AcceptLanguage
                .OrderByDescending(l => l.Quality ?? 1)
                .Select(l => l.Value.Value ?? "")
                .FirstOrDefault(l => l.StartsWith("en", StringComparison.OrdinalIgnoreCase) || l.StartsWith("id", StringComparison.OrdinalIgnoreCase))
                ?.StartsWith("en", StringComparison.OrdinalIgnoreCase) == true;
            CultureInfo.CurrentUICulture = english ? English : Indonesian;
            await next(http);
        });
}
