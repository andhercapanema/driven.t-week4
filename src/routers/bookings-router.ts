import { Router } from "express";
import { authenticateToken, validateBody } from "@/middlewares";
import { changeRoom, getBookings, postNewBooking } from "@/controllers";
import { bookingSchema } from "@/schemas";

const bookingsRouter = Router();

bookingsRouter
  .all("/*", authenticateToken)
  .get("/", getBookings)
  .all("/*", validateBody(bookingSchema))
  .post("/", postNewBooking)
  .put("/:bookingId", changeRoom);

export { bookingsRouter };
