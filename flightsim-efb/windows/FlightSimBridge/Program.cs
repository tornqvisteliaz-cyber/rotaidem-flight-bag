// Windows host for FlightSim EFB.
// SimConnect is only available with the MSFS 2024 SDK on Windows.
// This project keeps the same protocol as bridge/server.py:
// connection.status, flight.state, weather.updated, vatsim.updated, flight.plan.updated.
// Raw SimVar names stay inside SimConnectSession and are not sent to the iPad.

const string ProtocolVersion = "1";
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/api/status", () => new { server = true, msfs = false, note = "SimConnect session starts when the MSFS 2024 SDK is referenced." });
app.MapGet("/", () => Results.Text("FlightSim Bridge. Serve the built iPad app from this host on Windows."));
app.Run("http://0.0.0.0:8080");

static class SimVars
{
    public static readonly string[] Initial =
    {
        "PLANE LATITUDE", "PLANE LONGITUDE", "PLANE ALTITUDE",
        "AIRSPEED INDICATED", "AIRSPEED TRUE", "GROUND VELOCITY",
        "PLANE HEADING DEGREES TRUE", "VERTICAL SPEED", "AIRSPEED MACH",
        "SIM ON GROUND", "RADIO HEIGHT", "FUEL TOTAL QUANTITY",
        "ATC AIRLINE", "ATC FLIGHT NUMBER", "ATC ID", "TITLE"
    };
}
