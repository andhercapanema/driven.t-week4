import { Response } from "express";
import { AuthenticatedRequest } from "@/middlewares";
import httpStatus from "http-status";
import bookingService from "@/services/bookings-service";

export async function getBookings(req: AuthenticatedRequest, res: Response) {
  try {
    const booking = await bookingService.listBookings(req.userId);
    return res.status(httpStatus.OK).send(booking);
  } catch (error) {
    if (error.name === "NotFoundError") {
      return res.status(httpStatus.NOT_FOUND).send(error.message);
    }

    return res.status(httpStatus.FORBIDDEN).send(error);
  }
}

export async function postNewBooking(req: AuthenticatedRequest, res: Response) {
  const { userId } = req;
  const { roomId } = req.body;

  try {
    const bookingId = await bookingService.createNewBooking({ userId, roomId });
    return res.status(httpStatus.OK).send({ bookingId });
  } catch (error) {
    if (error.name === "NotFoundError") {
      return res.status(httpStatus.NOT_FOUND).send(error.message);
    }

    if (error.name === "ForbiddenError") {
      return res.status(httpStatus.FORBIDDEN).send(error.message);
    }

    if (error.name === "CannotListHotelsError") {
      return res.status(httpStatus.PAYMENT_REQUIRED).send(error.message);
    }

    return res.status(httpStatus.FORBIDDEN).send(error);
  }
}

export async function changeRoom(req: AuthenticatedRequest, res: Response) {
  const { userId } = req;
  const { roomId } = req.body;
  const { bookingId } = req.params;

  try {
    await bookingService.updateRoom(parseInt(bookingId), { userId, roomId });
    return res.status(httpStatus.OK).send({ bookingId });
  } catch (error) {
    if (error.name === "NotFoundError") {
      return res.status(httpStatus.NOT_FOUND).send(error.message);
    }

    if (error.name === "ForbiddenError") {
      return res.status(httpStatus.FORBIDDEN).send(error.message);
    }

    if (error.name === "CannotListHotelsError") {
      return res.status(httpStatus.PAYMENT_REQUIRED).send(error.message);
    }

    return res.status(httpStatus.FORBIDDEN).send(error);
  }
}
