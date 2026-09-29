using EventLy.Api.Common.Errors;
using Microsoft.AspNetCore.Http;
using Shouldly;

namespace EventLy.UnitTests.Common;

public sealed class AppExceptionHandlerTests
{
    [Fact]
    public void AppException_maps_to_its_status_code_and_stable_code()
    {
        var exception = new ConflictException(
            "invitation.already_checked_in", "Invitation already checked in", "Checked in at 10:12.");

        var problem = AppExceptionHandler.ToProblemDetails(exception);

        problem.Status.ShouldBe(StatusCodes.Status409Conflict);
        problem.Title.ShouldBe("Invitation already checked in");
        problem.Detail.ShouldBe("Checked in at 10:12.");
        problem.Type.ShouldBe("https://evently.app/errors/invitation.already_checked_in");
        problem.Extensions["code"].ShouldBe("invitation.already_checked_in");
    }

    [Theory]
    [InlineData(typeof(NotFoundException), StatusCodes.Status404NotFound)]
    [InlineData(typeof(ForbiddenException), StatusCodes.Status403Forbidden)]
    [InlineData(typeof(ConflictException), StatusCodes.Status409Conflict)]
    public void Each_exception_type_carries_the_expected_status(Type type, int expectedStatus)
    {
        var exception = (AppException)Activator.CreateInstance(type, "some.code", "Some title", null)!;

        AppExceptionHandler.ToProblemDetails(exception).Status.ShouldBe(expectedStatus);
    }

    [Fact]
    public void Unexpected_exception_becomes_500_without_leaking_its_message()
    {
        var problem = AppExceptionHandler.ToProblemDetails(
            new InvalidOperationException("connection string Password=secret"));

        problem.Status.ShouldBe(StatusCodes.Status500InternalServerError);
        problem.Extensions["code"].ShouldBe("server.unexpected");
        problem.Title!.ShouldNotContain("secret");
        problem.Detail.ShouldBeNull();
    }
}
