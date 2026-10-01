using System.Text;

namespace EventLy.Api.Services;

/// <summary>
/// "Kirim via WhatsApp" (decision Q-27): a wa.me link that opens WhatsApp with the message ready.
/// Free, no WhatsApp API; the organizer still presses Send.
/// </summary>
public static class WhatsAppMessage
{
    public const string NamePlaceholder = "{nama}";
    public const string EventPlaceholder = "{acara}";
    public const string LinkPlaceholder = "{link}";

    public const string DefaultTemplate =
        "Halo {nama},\n\nDengan hormat kami mengundang Anda ke {acara}.\n" +
        "Detail acara dan konfirmasi kehadiran ada di tautan berikut:\n{link}\n\nTerima kasih.";

    public static string Render(string? template, string guestName, string eventName, string url)
    {
        var text = string.IsNullOrWhiteSpace(template) ? DefaultTemplate : template;
        return text
            .Replace(NamePlaceholder, guestName, StringComparison.OrdinalIgnoreCase)
            .Replace(EventPlaceholder, eventName, StringComparison.OrdinalIgnoreCase)
            .Replace(LinkPlaceholder, url, StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Digits in international format for wa.me: "0812-3456 789" and "+62 812..." become "62812...".
    /// Null when there are too few digits to be a phone number.
    /// </summary>
    public static string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
        {
            return null;
        }

        var digits = new StringBuilder();
        foreach (var c in phone.Where(char.IsAsciiDigit))
        {
            digits.Append(c);
        }
        var number = digits.ToString();
        if (number.StartsWith('0'))
        {
            number = "62" + number[1..];
        }
        return number.Length is >= 8 and <= 15 ? number : null;
    }

    /// <summary>Without a phone number WhatsApp lets the organizer pick the contact.</summary>
    public static string Link(string? phone, string message) =>
        $"https://wa.me/{NormalizePhone(phone)}?text={Uri.EscapeDataString(message)}";
}
