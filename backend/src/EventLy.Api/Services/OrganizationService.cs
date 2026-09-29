using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Common.Options;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Npgsql;

namespace EventLy.Api.Services;

public sealed class OrganizationService(
    AppDbContext db,
    ICurrentUser currentUser,
    TokenService tokens,
    AuditService audit,
    IOptions<LegalOptions> legal,
    TimeProvider timeProvider)
{
    /// <summary>Onboarding. One Owner, one organization (also enforced by a unique index).</summary>
    public async Task<CreateOrganizationResponse> CreateAsync(CreateOrganizationRequest request, CancellationToken ct)
    {
        var user = await db.Users.SingleAsync(u => u.Id == currentUser.RequireUserId(), ct);
        if (user.Role != UserRole.Owner)
        {
            throw new ForbiddenException("organization.owner_only", "Only an Owner can create an organization.");
        }
        if (user.OrganizationId is not null)
        {
            throw new ConflictException("organization.already_exists", "You already have an organization.");
        }
        if (request.TermsVersion != legal.Value.TermsVersion)
        {
            throw new ConflictException("legal.terms_outdated",
                "The Terms have changed. Please reload the page and accept the current version.");
        }

        var organization = new Organization
        {
            Name = request.Name.Trim(),
            ContactEmail = Normalize(request.ContactEmail),
            ContactPhone = Normalize(request.ContactPhone),
            OwnerUserId = user.Id,
        };
        db.Organizations.Add(organization);
        user.OrganizationId = organization.Id;
        user.TermsVersion = request.TermsVersion;
        user.TermsAcceptedAt = timeProvider.GetUtcNow();
        audit.Add(AuditActions.OrganizationCreated, user.Id, organization.Id, nameof(Organization), organization.Id,
            new { termsVersion = request.TermsVersion });

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two onboarding requests at the same time: the unique index on owner_user_id lets only one win.
            throw new ConflictException("organization.already_exists", "You already have an organization.");
        }

        var access = tokens.CreateAccessToken(user);
        return new CreateOrganizationResponse(
            ToDto(organization),
            access.Token,
            (int)(access.ExpiresAt - timeProvider.GetUtcNow()).TotalSeconds,
            AuthService.ToDto(user));
    }

    public async Task<OrganizationDto> GetAsync(CancellationToken ct)
    {
        var organizationId = currentUser.RequireOrganizationId();
        var organization = await db.Organizations.AsNoTracking().SingleOrDefaultAsync(o => o.Id == organizationId, ct)
            ?? throw new NotFoundException("organization.not_found", "Organization not found.");
        return ToDto(organization);
    }

    public async Task<OrganizationDto> UpdateAsync(UpdateOrganizationRequest request, CancellationToken ct)
    {
        var organizationId = currentUser.RequireOrganizationId();
        var organization = await db.Organizations.SingleOrDefaultAsync(o => o.Id == organizationId, ct)
            ?? throw new NotFoundException("organization.not_found", "Organization not found.");

        organization.Name = request.Name.Trim();
        organization.ContactEmail = Normalize(request.ContactEmail);
        organization.ContactPhone = Normalize(request.ContactPhone);
        audit.Add(AuditActions.OrganizationUpdated, currentUser.UserId, organization.Id, nameof(Organization), organization.Id);
        await db.SaveChangesAsync(ct);
        return ToDto(organization);
    }

    public static OrganizationDto ToDto(Organization o) =>
        new(o.Id, o.Name, o.ContactEmail, o.ContactPhone, o.Status, o.CreatedAt);

    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
