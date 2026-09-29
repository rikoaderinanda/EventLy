namespace EventLy.Api.Common.Options;

/// <summary>The current version of the Terms &amp; Privacy Policy (docs/legal). Owners accept it at onboarding.</summary>
public sealed class LegalOptions
{
    public const string SectionName = "Legal";

    public string TermsVersion { get; init; } = "2026-09-29";
}
