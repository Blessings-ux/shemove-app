import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import {
  PICKUP_STEPS,
  canDriverMarkArrived,
  canDriverStartRide,
  canPassengerConfirmArrival,
  getDriverStatusMessage,
  getPassengerStatusMessage,
  getPickupStepIndex,
} from "./src/utils/pickupFlow.js";

const envStr = fs.readFileSync(".env", "utf-8");
const env = Object.fromEntries(
  envStr
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const match = line.match(/^([^=]+)=(.*)$/);
      return match ? [match[1].trim(), match[2].trim().replace(/\r/g, "")] : null;
    })
    .filter(Boolean),
);

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_ANON_KEY;

let passed = 0;
let failed = 0;

function ok(name, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n=== ${title} ===`);
}

section("Unit: pickup flow helpers");
ok("pickup steps count", PICKUP_STEPS.length === 4);
ok("accepted step index", getPickupStepIndex("accepted") === 0);
ok("arrived step index", getPickupStepIndex("arrived") === 1);
ok("passenger_arrived step index", getPickupStepIndex("passenger_arrived") === 2);
ok("in_progress step index", getPickupStepIndex("in_progress") === 3);
ok("driver can mark arrived from accepted", canDriverMarkArrived("accepted"));
ok("driver cannot mark arrived from arrived", !canDriverMarkArrived("arrived"));
ok("passenger can confirm from arrived", canPassengerConfirmArrival("arrived"));
ok("passenger cannot confirm from accepted", !canPassengerConfirmArrival("accepted"));
ok("driver can start from passenger_arrived", canDriverStartRide("passenger_arrived"));
ok("driver cannot start from arrived", !canDriverStartRide("arrived"));
ok(
  "passenger message for arrived",
  getPassengerStatusMessage({ status: "arrived" }).title === "Driver has arrived",
);
ok(
  "driver message for passenger_arrived",
  getDriverStatusMessage({ status: "passenger_arrived" }).title === "Passenger is here",
);

if (!supabaseUrl || !supabaseKey) {
  section("Integration skipped");
  console.log("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  printSummary();
  process.exit(failed > 0 ? 1 : 0);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const stamp = Date.now();
const testPassword = `TestPass123!${stamp}`;
const passengerEmail = `pickup-passenger-${stamp}@test.shemove.local`;
const driverEmail = `pickup-driver-${stamp}@test.shemove.local`;

async function signUp(email, role, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password: testPassword,
    options: {
      data: { full_name: fullName, phone: "+254700000001", role },
    },
  });
  if (error) throw new Error(`Sign up failed for ${role}: ${error.message}`);
  return data.user;
}

async function signIn(email) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password: testPassword,
  });
  if (error) throw new Error(`Sign in failed for ${email}: ${error.message}`);
  return data.user;
}

async function runIntegrationTests() {
  section("Integration: database + pickup sequence");

  let passengerUser;
  let driverUser;
  let rideId;

  try {
    passengerUser = await signUp(passengerEmail, "passenger", "Pickup Test Passenger");
    ok("passenger account created", !!passengerUser?.id, passengerEmail);

    driverUser = await signUp(driverEmail, "driver", "Pickup Test Driver");
    ok("driver account created", !!driverUser?.id, driverEmail);

    await supabase.from("drivers").upsert(
      {
        id: driverUser.id,
        vehicle_type: "boda",
        plate_number: "TEST-001",
        is_online: true,
      },
      { onConflict: "id" },
    );

    await signIn(passengerEmail);

    const { data: ride, error: rideError } = await supabase
      .from("rides")
      .insert({
        passenger_id: passengerUser.id,
        driver_id: driverUser.id,
        pickup_location: "POINT(36.8219 -1.2921)",
        dropoff_location: "POINT(36.8319 -1.3021)",
        pickup_latitude: -1.2921,
        pickup_longitude: 36.8219,
        dropoff_latitude: -1.3021,
        dropoff_longitude: 36.8319,
        fare: 350,
        status: "accepted",
      })
      .select("*")
      .single();

    ok("test ride created", !rideError && !!ride?.id, rideError?.message || ride?.id);
    rideId = ride?.id;

    const { data: driverArrived, error: driverArrivedError } = await supabase
      .from("rides")
      .update({
        status: "arrived",
        driver_arrived_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select("status, driver_arrived_at")
      .single();

    ok(
      "driver arrived update",
      !driverArrivedError && driverArrived?.status === "arrived",
      driverArrivedError?.message,
    );
    ok("driver_arrived_at set", !!driverArrived?.driver_arrived_at);

    const { data: passengerArrived, error: passengerArrivedError } = await supabase
      .from("rides")
      .update({
        status: "passenger_arrived",
        passenger_arrived_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select("status, passenger_arrived_at")
      .single();

    ok(
      "passenger_arrived enum accepted",
      !passengerArrivedError && passengerArrived?.status === "passenger_arrived",
      passengerArrivedError?.message ||
        "If this fails, run migration 017 to add passenger_arrived to ride_status enum",
    );
    ok("passenger_arrived_at set", !!passengerArrived?.passenger_arrived_at);

    await signIn(driverEmail);

    const { data: startedRide, error: startError } = await supabase
      .from("rides")
      .update({
        status: "in_progress",
        ride_started_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select("status, ride_started_at")
      .single();

    ok(
      "ride started after passenger arrival",
      !startError && startedRide?.status === "in_progress",
      startError?.message,
    );
    ok("ride_started_at set", !!startedRide?.ride_started_at);

    const { data: completedRide, error: completeError } = await supabase
      .from("rides")
      .update({
        status: "completed",
        ride_completed_at: new Date().toISOString(),
      })
      .eq("id", rideId)
      .select("status")
      .single();

    ok(
      "ride completed",
      !completeError && completedRide?.status === "completed",
      completeError?.message,
    );
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  integration flow — ${error.message}`);
  }

  section("Integration: admin delete RPC availability");
  try {
    const { error } = await supabase.rpc("admin_delete_user", {
      target_user_id: "00000000-0000-0000-0000-000000000000",
    });

    ok(
      "admin_delete_user RPC exists",
      !!error && !error.message.includes("Could not find the function"),
      error?.message || "unexpected success",
    );
    ok(
      "admin_delete_user rejects non-admin caller",
      !!error &&
        (error.message.includes("Unauthorized") ||
          error.message.includes("permission") ||
          error.message.includes("not found")),
      error?.message,
    );
  } catch (error) {
    failed += 1;
    console.error(`  FAIL  admin RPC check — ${error.message}`);
  }
}

function printSummary() {
  section("Summary");
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
}

await runIntegrationTests();
printSummary();
process.exit(failed > 0 ? 1 : 0);
