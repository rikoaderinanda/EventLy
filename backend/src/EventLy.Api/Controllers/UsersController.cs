using EventLy.Api.Auth;
using EventLy.Api.Dtos.Users;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Admin and Staff of the caller's organization. Owner only (decision Q-3: Admin stays strict).</summary>
[ApiController]
[Route("api/v1/users")]
[Authorize(Policy = Permissions.UsersManageAdmin)]
[Authorize(Policy = Permissions.UsersManageStaff)]
public sealed class UsersController(UserService users) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<OrganizationUserDto>> List([FromQuery] UserRole? role, CancellationToken ct) =>
        users.ListAsync(role, ct);

    [HttpPost]
    [ProducesResponseType<OrganizationUserDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<OrganizationUserDto>> Invite(InviteUserRequest request, CancellationToken ct)
    {
        var invited = await users.InviteAsync(request, ct);
        return Created($"/api/v1/users/{invited.Id}", invited);
    }

    [HttpPut("{id:guid}")]
    public Task<OrganizationUserDto> Update(Guid id, UpdateUserRequest request, CancellationToken ct) =>
        users.UpdateAsync(id, request, ct);

    /// <summary>Removes a pending invitation. Accounts that have signed in are disabled via PUT instead.</summary>
    [HttpDelete("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> CancelInvitation(Guid id, CancellationToken ct)
    {
        await users.CancelInvitationAsync(id, ct);
        return NoContent();
    }
}
