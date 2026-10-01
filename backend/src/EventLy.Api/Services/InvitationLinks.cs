using EventLy.Api.Common.Options;
using Microsoft.Extensions.Options;

namespace EventLy.Api.Services;

/// <summary>
/// Builds the guest's invitation URL <c>{origin}/i/{code}</c>. The URL is derived from the code instead of
/// being stored, so a new domain doesn't leave old links in the database. It is also the QR payload (Q-8).
/// </summary>
public sealed class InvitationLinks(IHttpContextAccessor httpContextAccessor, IOptions<AppOptions> options)
{
    public string Url(string code) => $"{Origin()}/i/{code}";

    private string Origin()
    {
        if (!string.IsNullOrWhiteSpace(options.Value.PublicBaseUrl))
        {
            return options.Value.PublicBaseUrl.TrimEnd('/');
        }

        var request = httpContextAccessor.HttpContext?.Request
            ?? throw new InvalidOperationException("App:PublicBaseUrl is required outside an HTTP request.");
        return $"{request.Scheme}://{request.Host}";
    }
}
