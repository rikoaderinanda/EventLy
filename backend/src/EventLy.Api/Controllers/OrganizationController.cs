using EventLy.Api.Auth;
using EventLy.Api.Dtos.Organizations;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>The caller's own organization (singular: a user belongs to exactly one).</summary>
[ApiController]
[Route("api/v1/organization")]
public sealed class OrganizationController(OrganizationService organizations) : ControllerBase
{
    /// <summary>Onboarding: create the organization and accept the Terms. Returns a new access token with <c>org_id</c>.</summary>
    [HttpPost]
    [Authorize(Policy = Permissions.OrganizationManage)]
    [ProducesResponseType<CreateOrganizationResponse>(StatusCodes.Status201Created)]
    public async Task<ActionResult<CreateOrganizationResponse>> Create(CreateOrganizationRequest request, CancellationToken ct)
    {
        var created = await organizations.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), created);
    }

    [HttpGet]
    [Authorize(Policy = Permissions.OrganizationView)]
    public Task<OrganizationDto> Get(CancellationToken ct) => organizations.GetAsync(ct);

    [HttpPut]
    [Authorize(Policy = Permissions.OrganizationManage)]
    public Task<OrganizationDto> Update(UpdateOrganizationRequest request, CancellationToken ct) =>
        organizations.UpdateAsync(request, ct);
}
