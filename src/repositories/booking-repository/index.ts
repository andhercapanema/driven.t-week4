import { prisma } from "@/config";

async function createNewBooking(bookingCreateInput: BookingCreateInput) {
  return prisma.booking.create({
    data: bookingCreateInput,
  });
}

async function countBookingsByRoomId(roomId: number) {
  return prisma.booking.count({
    where: { roomId },
  });
}

async function findBookingByUserIdWithRoom(userId: number) {
  return prisma.booking.findFirst({
    where: { userId },
    select: { id: true, Room: true },
  });
}

async function updateBookingById(id: number, bookingUpdateInput: BookingCreateInput) {
  return prisma.booking.update({
    where: { id },
    data: bookingUpdateInput,
  });
}

const bookingRepository = {
  createNewBooking,
  countBookingsByRoomId,
  findBookingByUserIdWithRoom,
  updateBookingById,
};

export default bookingRepository;

export type BookingCreateInput = {
  userId: number;
  roomId: number;
};
