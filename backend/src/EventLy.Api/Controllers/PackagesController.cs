using EventLy.Api.Auth;
using EventLy.Api.Dtos.Packages;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

/// <summary>The active package catalog, for Owners and Admins choosing a package.</summary>
[ApiController]
[Route("api/v1/packages")]
[Authorize(Policy = Permissions.PackageView)]
public sealed class PackagesController(PackageService packages) : ControllerBase
{
    [HttpGet]
    public Task<IReadOnlyList<PackageDto>> List(CancellationToken ct) => packages.ListActiveAsync(ct);

    [HttpGet("{id:guid}")]
    public Task<PackageDto> Get(Guid id, CancellationToken ct) => packages.GetActiveAsync(id, ct);
}
