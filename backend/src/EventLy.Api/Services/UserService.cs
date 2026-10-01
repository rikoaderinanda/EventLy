using EventLy.Api.Auth;
using EventLy.Api.Common.Errors;
using EventLy.Api.Data;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EventLy.Api.Services;

/// <summary>
/// The Owner manages the Admin and Staff of their organization. Users have no global tenant filter
/// (see <see cref="ITenantOwned"/>), so every query here filters on the caller's organization, and a
/// user of another organization is simply "not found" (404).
/// The number of Admins is limited by the packages (decision Q-50/Q-54).
/// </summary>
public sealed class UserService(AppDbContext db, ICurrentUser currentUser, AuditService audit)
{
    public async Task<IReadOnlyList<OrganizationUserDto>> ListAsync(UserRole? role, CancellationToken ct)
    {
        var organizationId = currentUser.RequireOrganizationId();
        var query = db.Users.AsNoTracking().Where(u => u.OrganizationId == organizationId);
        if (role is not null)
        {
            query = query.Where(u => u.Role == role);
        }

        return await query
            .OrderBy(u => u.Role).ThenBy(u => u.Name)
            .Select(u => new OrganizationUserDto(
                u.Id, u.Name, u.Email, u.AvatarUrl, u.Role, u.Status, u.LastSignInAt, u.CreatedAt))
            .ToListAsync(ct);
    }

    /// <summary>
    /// Registers an Admin/Staff by Google email. They become Active on their first Google sign-in.
    /// One email belongs to one organization, so an email already used anywhere is refused.
    /// </summary>
    public async Task<OrganizationUserDto> InviteAsync(InviteUserRequest request, CancellationToken ct)
    {
        var organizationId = currentUser.RequireOrganizationId();
        var email = request.Email.Trim();
        if (await db.Users.AnyAsync(u => u.Email == email, ct))
        {
            throw EmailTaken();
        }

        try
        {
            return await InLockedOrganizationAsync(organizationId, async () =>
            {
                if (request.Role == UserRole.Admin)
                {
                    await RequireAdminPlaceAsync(organizationId, exceptUserId: null, ct);
                }

                var user = new User
                {
                    Name = request.Name.Trim(),
                    Email = email,
                    Role = request.Role,
                    Status = UserStatus.Invited,
                    OrganizationId = organizationId,
                };
                db.Users.Add(user);
                audit.Add(AuditActions.UserInvited, currentUser.UserId, organizationId, nameof(User), user.Id,
                    new { role = request.Role.ToString() });
                return user;
            }, ct);
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            throw EmailTaken();
        }
    }

    public Task<OrganizationUserDto> UpdateAsync(Guid userId, UpdateUserRequest request, CancellationToken ct) =>
        InLockedOrganizationAsync(currentUser.RequireOrganizationId(), () => ApplyUpdateAsync(userId, request, ct), ct);

    private async Task<User> ApplyUpdateAsync(Guid userId, UpdateUserRequest request, CancellationToken ct)
    {
        var user = await FindInOrganizationAsync(userId, ct);
        if (user.Role == UserRole.Owner)
        {
            throw new ForbiddenException("user.owner_immutable", "The Owner account can't be changed here.");
        }

        var previous = new { role = user.Role.ToString(), status = user.Status.ToString() };
        var newStatus = request.Status switch
        {
            // "Invited" ends only with the person's own first Google sign-in.
            UserStatus.Active when user.GoogleSubject is null => UserStatus.Invited,
            _ => request.Status,
        };

        // Becoming an Admin who counts (promoted, or re-enabled) needs a free Admin place.
        var countedBefore = user.Role == UserRole.Admin && user.Status != UserStatus.Disabled;
        var countedAfter = request.Role == UserRole.Admin && newStatus != UserStatus.Disabled;
        if (countedAfter && !countedBefore)
        {
            await RequireAdminPlaceAsync(user.OrganizationId!.Value, exceptUserId: user.Id, ct);
        }

        if (user.Role != request.Role || user.Status != newStatus)
        {
            // Ends existing sessions so the new role/status applies at the next refresh.
            user.SecurityStamp = Guid.NewGuid();
        }

        user.Name = request.Name.Trim();
        user.Role = request.Role;
        user.Status = newStatus;
        audit.Add(AuditActions.UserUpdated, currentUser.UserId, user.OrganizationId, nameof(User), user.Id,
            new { previous, current = new { role = user.Role.ToString(), status = user.Status.ToString() } });
        return user;
    }

    /// <summary>Removes an invitation that was never used. People who have signed in are disabled instead.</summary>
    public async Task CancelInvitationAsync(Guid userId, CancellationToken ct)
    {
        var user = await FindInOrganizationAsync(userId, ct);
        if (user.Status != UserStatus.Invited)
        {
            throw new ConflictException("user.not_invited",
                "Only a pending invitation can be removed. Disable the account instead.");
        }

        db.Users.Remove(user);
        audit.Add(AuditActions.UserInvitationCancelled, currentUser.UserId, user.OrganizationId, nameof(User), user.Id);
        await db.SaveChangesAsync(ct);
    }

    /// <summary>
    /// The Admin limit (Q-54): the largest <c>maxAdmins</c> among the organization's Active events; with no
    /// Active event, the largest offered package, so the Owner can get help preparing the first event.
    /// Invited and active Admins count; disabled ones don't. Existing Admins are never removed.
    /// </summary>
    private async Task RequireAdminPlaceAsync(Guid organizationId, Guid? exceptUserId, CancellationToken ct)
    {
        var active = await db.Events.AsNoTracking()
            .Where(e => e.Status == EventStatus.Active && e.PackageSnapshot != null)
            .ToListAsync(ct);
        var limit = active.Count > 0
            ? active.Max(e => e.PackageSnapshot!.Features.MaxAdmins)
            : (await db.Packages.AsNoTracking().Where(p => p.IsActive).ToListAsync(ct))
                .Select(p => p.Features.MaxAdmins).DefaultIfEmpty(0).Max();

        var admins = await db.Users.CountAsync(u => u.OrganizationId == organizationId && u.Role == UserRole.Admin
            && u.Status != UserStatus.Disabled && u.Id != exceptUserId, ct);
        if (admins >= limit)
        {
            throw new QuotaExceededException("user.admin_limit_exceeded",
                $"Your package allows {limit} admin(s). Disable an admin first, or choose a bigger package.");
        }
    }

    /// <summary>
    /// Runs a membership change in a transaction holding a row lock on the organization, so two invitations
    /// at the same moment can't both take the last Admin place.
    /// </summary>
    private Task<OrganizationUserDto> InLockedOrganizationAsync(Guid organizationId, Func<Task<User>> change, CancellationToken ct)
    {
        var strategy = db.Database.CreateExecutionStrategy();
        return strategy.ExecuteAsync(async () =>
        {
            db.ChangeTracker.Clear();
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            await db.Database.ExecuteSqlAsync($"SELECT 1 FROM organizations WHERE id = {organizationId} FOR UPDATE", ct);
            var user = await change();
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return ToDto(user);
        });
    }

    private async Task<User> FindInOrganizationAsync(Guid userId, CancellationToken ct)
    {
        var organizationId = currentUser.RequireOrganizationId();
        return await db.Users.SingleOrDefaultAsync(u => u.Id == userId && u.OrganizationId == organizationId, ct)
            ?? throw new NotFoundException("user.not_found", "User not found.");
    }

    private static OrganizationUserDto ToDto(User u) =>
        new(u.Id, u.Name, u.Email, u.AvatarUrl, u.Role, u.Status, u.LastSignInAt, u.CreatedAt);

    private static ConflictException EmailTaken() =>
        new("user.email_taken", "This email is already registered in EventLy.");
}
