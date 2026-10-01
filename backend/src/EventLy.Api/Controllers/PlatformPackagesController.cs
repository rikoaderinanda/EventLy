using EventLy.Api.Auth;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>Root: the package catalog, including inactive packages (decision Q-2).</summary>
[ApiController]
[Route("api/v1/platform/packages")]
[Authorize(Policy = Permissions.PlatformPackagesManage)]
public sealed class PlatformPackagesController(PackageService packages) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PackageDto>> List(CancellationToken ct) => packages.ListAllAsync(ct);

    [HttpPost]
    [ProducesResponseType<PackageDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<PackageDto>> Create(CreatePackageRequest request, CancellationToken ct)
    {
        var created = await packages.CreateAsync(request, ct);
        return StatusCode(StatusCodes.Status201Created, created);
    }

    [HttpPut("{id:guid}")]
    public Task<PackageDto> Update(Guid id, UpdatePackageRequest request, CancellationToken ct) =>
        packages.UpdateAsync(id, request, ct);
}
