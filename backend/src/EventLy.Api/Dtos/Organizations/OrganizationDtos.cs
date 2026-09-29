using EventLy.Api.Entities;

namespace EventLy.Api.Dtos.Organizations;

public sealed record OrganizationDto(
    Guid Id,
    string Name,
    string? ContactEmail,
    string? ContactPhone,
    OrganizationStatus Status,
    DateTimeOffset CreatedAt);

/// <summary>Onboarding: the Owner creates their organization and accepts the Terms &amp; Privacy Policy.</summary>
public sealed record CreateOrganizationRequest(
    string Name,
    string? ContactEmail,
    string? ContactPhone,
    bool AcceptTerms,
    string TermsVersion);

public sealed record UpdateOrganizationRequest(string Name, string? ContactEmail, string? ContactPhone);

/// <summary>After onboarding the access token is re-issued so it carries the new <c>org_id</c>.</summary>
public sealed record CreateOrganizationResponse(
    OrganizationDto Organization, string AccessToken, int ExpiresIn, Dtos.Auth.CurrentUserDto User);
