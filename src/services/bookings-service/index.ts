import bookingRepository, { BookingCreateInput } from "@/repositories/booking-repository";
import roomRepository from "@/repositories/room-repository";
import { forbiddenError, notFoundError } from "@/errors";
import hotelService from "../hotels-service";

async function listBookings(userId: number) {
  const booking = await bookingRepository.findBookingByUserIdWithRoom(userId);

  if (!booking) throw notFoundError();

  return booking;
}

async function checkIfRoomsExistsAndIsVacant(bookingData: BookingCreateInput) {
  const { roomId, userId } = bookingData;

  await hotelService.listHotels(userId);

  const room = await roomRepository.findRoomById(roomId);

  if (!room) throw notFoundError();

  const roomBookingsAmount = await bookingRepository.countBookingsByRoomId(roomId);

  if (roomBookingsAmount >= room.capacity) throw forbiddenError();
}

async function createNewBooking(bookingCreateInput: BookingCreateInput) {
  await checkIfRoomsExistsAndIsVacant(bookingCreateInput);

  const createdBooking = await bookingRepository.createNewBooking(bookingCreateInput);
  return createdBooking.id;
}

async function updateRoom(bookingId: number, bookingUpdateInput: BookingCreateInput) {
  await listBookings(bookingUpdateInput.userId);

  await checkIfRoomsExistsAndIsVacant(bookingUpdateInput);

  await bookingRepository.updateBookingById(bookingId, bookingUpdateInput);
}

const bookingService = {
  listBookings,
  createNewBooking,
  updateRoom,
};

export default bookingService;
