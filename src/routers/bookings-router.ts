import { Router } from "express";
import { authenticateToken } from "@/middlewares";
import { changeRoom, getBookings, postNewBooking } from "@/controllers";

const bookingsRouter = Router();

bookingsRouter
  .all("/*", authenticateToken)
  .get("/", getBookings)
  .post("/", postNewBooking)
  .put("/:bookingId", changeRoom);

export { bookingsRouter };
