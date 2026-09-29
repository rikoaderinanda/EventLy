namespace EventLy.Api.Entities;

/// <summary>
/// Business data that belongs to one organization (events, guests, invitations, photos... from Phase 4).
/// <see cref="Data.AppDbContext"/> adds a global query filter on <see cref="OrganizationId"/> for every
/// entity implementing it, and <see cref="Data.Interceptors.TenantInterceptor"/> stamps it on insert and
/// refuses writes that cross tenants.
/// <para>
/// <see cref="User"/> deliberately does not implement it: sign-in and Root must look users up across
/// organizations, so user queries in the organization area filter by organization explicitly.
/// </para>
/// </summary>
public interface ITenantOwned
{
    Guid OrganizationId { get; set; }
}
