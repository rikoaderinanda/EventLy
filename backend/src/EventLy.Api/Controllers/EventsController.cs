using EventLy.Api.Auth;
using EventLy.Api.Dtos.Events;
using EventLy.Api.Entities;
using EventLy.Api.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace EventLy.Api.Controllers;

[ApiController]
[Route("api/v1/events")]
public sealed class EventsController(EventService events) : ControllerBase
{
    /// <summary>Owner/Admin: all events of the organization. Staff: only events they are assigned to.</summary>
    [HttpGet]
    [Authorize(Policy = Permissions.EventView)]
    public Task<IReadOnlyList<EventListItemDto>> List(
        [FromQuery] EventStatus? status,
        [FromQuery] EventCategory? category,
        [FromQuery] DateTimeOffset? from,
        [FromQuery] DateTimeOffset? to,
        CancellationToken ct) =>
        events.ListAsync(new EventListQuery(status, category, from, to), ct);

    [HttpPost]
    [Authorize(Policy = Permissions.EventManage)]
    [ProducesResponseType<EventDto>(StatusCodes.Status201Created)]
    public async Task<ActionResult<EventDto>> Create(CreateEventRequest request, CancellationToken ct)
    {
        var created = await events.CreateAsync(request, ct);
        return CreatedAtAction(nameof(Get), new { id = created.Id }, created);
    }

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Permissions.EventView)]
    public Task<EventDto> Get(Guid id, CancellationToken ct) => events.GetAsync(id, ct);

    [HttpPut("{id:guid}")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<EventDto> Update(Guid id, UpdateEventRequest request, CancellationToken ct) =>
        events.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Permissions.EventManage)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await events.DeleteAsync(id, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/cancel")]
    [Authorize(Policy = Permissions.EventCancel)]
    public Task<EventDto> Cancel(Guid id, CancellationToken ct) => events.CancelAsync(id, ct);

    [HttpPost("{id:guid}/complete")]
    [Authorize(Policy = Permissions.EventManage)]
    public Task<EventDto> Complete(Guid id, CancellationToken ct) => events.CompleteAsync(id, ct);

    [HttpGet("{id:guid}/staff")]
    [Authorize(Policy = Permissions.EventAssignStaff)]
    public Task<IReadOnlyList<EventStaffDto>> GetStaff(Guid id, CancellationToken ct) => events.GetStaffAsync(id, ct);

    [HttpPut("{id:guid}/staff")]
    [Authorize(Policy = Permissions.EventAssignStaff)]
    public Task<IReadOnlyList<EventStaffDto>> AssignStaff(Guid id, AssignStaffRequest request, CancellationToken ct) =>
        events.AssignStaffAsync(id, request, ct);
}
