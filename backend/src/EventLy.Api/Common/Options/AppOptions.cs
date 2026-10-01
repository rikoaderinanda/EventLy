namespace EventLy.Api.Common.Options;

/// <summary>Settings under <c>App</c>.</summary>
public sealed class AppOptions
{
    public const string SectionName = "App";

    /// <summary>
    /// Origin of the PWA used in invitation links and QR codes, for example <c>https://evently.id</c>.
    /// Empty uses the origin of the current request (behind Cloud Run via the forwarded headers).
    /// </summary>
    public string PublicBaseUrl { get; init; } = "";
}
