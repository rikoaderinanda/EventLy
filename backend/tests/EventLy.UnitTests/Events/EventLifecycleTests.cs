using EventLy.Api.Entities;
using Shouldly;

namespace EventLy.UnitTests.Events;

/// <summary>Pins the event lifecycle (decision Q-4, no refund Q-32).</summary>
public sealed class EventLifecycleTests
{
    public static TheoryData<EventStatus, EventStatus> Allowed => new()
    {
        { EventStatus.Draft, EventStatus.PendingPayment },
        { EventStatus.PendingPayment, EventStatus.Draft },
        { EventStatus.PendingPayment, EventStatus.Active },
        { EventStatus.Draft, EventStatus.Active }, // Root's manual activation
        { EventStatus.Active, EventStatus.Completed },
        { EventStatus.Draft, EventStatus.Cancelled },
        { EventStatus.PendingPayment, EventStatus.Cancelled },
        { EventStatus.Active, EventStatus.Cancelled },
    };

    [Theory]
    [MemberData(nameof(Allowed))]
    public void Allowed_change(EventStatus from, EventStatus to) =>
        EventLifecycle.CanChange(from, to).ShouldBeTrue();

    [Fact]
    public void Every_other_change_is_refused()
    {
        var allowed = Allowed.Select(row => row.Data).ToHashSet();
        foreach (var from in Enum.GetValues<EventStatus>())
        {
            foreach (var to in Enum.GetValues<EventStatus>().Where(to => !allowed.Contains((from, to))))
            {
                EventLifecycle.CanChange(from, to).ShouldBeFalse($"{from} -> {to}");
            }
        }
    }

    [Theory]
    [InlineData(EventStatus.Draft, true)]
    [InlineData(EventStatus.PendingPayment, true)]
    [InlineData(EventStatus.Active, true)]
    [InlineData(EventStatus.Completed, false)]
    [InlineData(EventStatus.Cancelled, false)]
    public void Only_open_events_are_editable(EventStatus status, bool editable) =>
        EventLifecycle.IsEditable(status).ShouldBe(editable);

    [Theory]
    [InlineData(EventStatus.Draft, true)]
    [InlineData(EventStatus.PendingPayment, false)]
    [InlineData(EventStatus.Active, false)]
    [InlineData(EventStatus.Completed, false)]
    [InlineData(EventStatus.Cancelled, true)]
    public void Only_drafts_and_cancelled_events_are_deletable(EventStatus status, bool deletable) =>
        EventLifecycle.IsDeletable(status).ShouldBe(deletable);
}
