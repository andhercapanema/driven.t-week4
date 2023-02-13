import app, { init } from "@/app";
import { prisma } from "@/config";
import faker from "@faker-js/faker";
import { TicketStatus } from "@prisma/client";
import httpStatus from "http-status";
import * as jwt from "jsonwebtoken";
import supertest from "supertest";
import {
  createEnrollmentWithAddress,
  createUser,
  createTicket,
  createTicketTypeWithHotel,
  createHotel,
  createRandomRoomWithHotelId,
  createBooking,
  createTicketTypeRemote,
  createTicketTypeWithoutHotel,
  createOccupiedRoomWithHotelId,
} from "../factories";
import { cleanDb, generateValidToken } from "../helpers";

beforeAll(async () => {
  await init();
});

beforeEach(async () => {
  await cleanDb();
});

const server = supertest(app);

describe("POST /booking", () => {
  it("should respond with status 401 if no token is given", async () => {
    const response = await server.post("/booking");

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if given token is not valid", async () => {
    const token = faker.lorem.word();

    const response = await server.post("/booking").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if there is no session for given token", async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.post("/booking").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe("when token is valid", () => {
    it("should respond with status 400 when body is not present", async () => {
      const token = await generateValidToken();

      const response = await server.post("/booking").set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    it("should respond with status 400 when body is not valid", async () => {
      const token = await generateValidToken();
      const invalidBody = { [faker.lorem.word()]: faker.lorem.word() };

      const response = await server.post("/booking").set("Authorization", `Bearer ${token}`).send(invalidBody);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    describe("when body is valid", () => {
      it("should respond with status 404 when user does not have an enrollment", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        const hotel = await createHotel();
        const room = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .post("/booking")
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: room.id });

        expect(response.status).toEqual(httpStatus.NOT_FOUND);
      });

      it("should respond with status 402 when user does not have a ticket", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        await createEnrollmentWithAddress(user);

        const hotel = await createHotel();
        const room = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .post("/booking")
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: room.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket with TicketType.isRemote = true", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeRemote();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .post("/booking")
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: room.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket with TicketType.includesHotel = false", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithoutHotel();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const room = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .post("/booking")
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: room.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket not paid", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);

        const hotel = await createHotel();
        const room = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .post("/booking")
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: room.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      describe("when user owns a valid ticket", () => {
        it("should respond with status 404 when given roomId does not exists", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          await createHotel();

          const response = await server
            .post("/booking")
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: faker.datatype.number() });

          expect(response.status).toEqual(httpStatus.NOT_FOUND);
        });

        it("should respond with status 403 when inserted room is not vacant", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const room = await createOccupiedRoomWithHotelId(hotel.id);

          const response = await server
            .post("/booking")
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: room.id });

          expect(response.status).toEqual(httpStatus.FORBIDDEN);
        });

        it("should respond with status 200 and create new booking", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const room = await createRandomRoomWithHotelId(hotel.id);

          const response = await server
            .post("/booking")
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: room.id });

          expect(response.status).toEqual(httpStatus.OK);
          expect(response.body).toEqual({
            bookingId: expect.any(Number),
          });

          const createdBooking = await prisma.booking.findFirst({
            where: {
              userId: user.id,
              roomId: room.id,
            },
          });

          expect(createdBooking.id).toBe(response.body.bookingId);
        });
      });
    });
  });
});

describe("GET /booking", () => {
  it("should respond with status 401 if no token is given", async () => {
    const response = await server.get("/booking");

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if given token is not valid", async () => {
    const token = faker.lorem.word();

    const response = await server.get("/booking").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if there is no session for given token", async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);

    const response = await server.get("/booking").set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe("when token is valid", () => {
    it("should respond with status 404 when user does not have a booking", async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotel();
      await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      const hotel = await createHotel();
      await createRandomRoomWithHotelId(hotel.id);

      const response = await server.get("/booking").set("Authorization", `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.NOT_FOUND);
    });

    it("should respond with status 200 when user has a booking", async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const enrollment = await createEnrollmentWithAddress(user);
      const ticketType = await createTicketTypeWithHotel();
      await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);
      const hotel = await createHotel();
      const room = await createRandomRoomWithHotelId(hotel.id);
      const booking = await createBooking(user.id, room.id);

      const response = await server.get("/booking").set("Authorization", `Bearer ${token}`);

      expect(response.status).toEqual(httpStatus.OK);
      expect(response.body).toEqual({
        id: booking.id,
        Room: { ...room, createdAt: room.createdAt.toISOString(), updatedAt: room.updatedAt.toISOString() },
      });
    });
  });
});

describe("PUT /booking/:bookingId", () => {
  it("should respond with status 401 if no token is given", async () => {
    const user = await createUser();
    const hotel = await createHotel();
    const room = await createRandomRoomWithHotelId(hotel.id);
    const booking = await createBooking(user.id, room.id);

    const response = await server.put(`/booking/${booking.id}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if given token is not valid", async () => {
    const token = faker.lorem.word();
    const user = await createUser();
    const hotel = await createHotel();
    const room = await createRandomRoomWithHotelId(hotel.id);
    const booking = await createBooking(user.id, room.id);

    const response = await server.put(`/booking/${booking.id}`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  it("should respond with status 401 if there is no session for given token", async () => {
    const userWithoutSession = await createUser();
    const token = jwt.sign({ userId: userWithoutSession.id }, process.env.JWT_SECRET);
    const hotel = await createHotel();
    const room = await createRandomRoomWithHotelId(hotel.id);
    const booking = await createBooking(userWithoutSession.id, room.id);

    const response = await server.put(`/booking/${booking.id}`).set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(httpStatus.UNAUTHORIZED);
  });

  describe("when token is valid", () => {
    it("should respond with status 400 when body is not present", async () => {
      const user = await createUser();
      const token = await generateValidToken(user);
      const hotel = await createHotel();
      const room = await createRandomRoomWithHotelId(hotel.id);
      const booking = await createBooking(user.id, room.id);

      const response = await server.put(`/booking/${booking.id}`).set("Authorization", `Bearer ${token}`);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    it("should respond with status 400 when body is not valid", async () => {
      const invalidBody = { [faker.lorem.word()]: faker.lorem.word() };
      const user = await createUser();
      const token = await generateValidToken(user);
      const hotel = await createHotel();
      const room = await createRandomRoomWithHotelId(hotel.id);
      const booking = await createBooking(user.id, room.id);

      const response = await server
        .put(`/booking/${booking.id}`)
        .set("Authorization", `Bearer ${token}`)
        .send(invalidBody);

      expect(response.status).toBe(httpStatus.BAD_REQUEST);
    });

    describe("when body is valid", () => {
      it("should respond with status 404 when user does not have a booking", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        const hotel = await createHotel();
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${faker.datatype.number()}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.NOT_FOUND);
      });

      it("should respond with status 404 when user does not have an enrollment", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);

        const hotel = await createHotel();
        const currentRoom = await createRandomRoomWithHotelId(hotel.id);
        const booking = await createBooking(user.id, currentRoom.id);
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${booking.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.NOT_FOUND);
      });

      it("should respond with status 402 when user does not have a ticket", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        await createEnrollmentWithAddress(user);

        const hotel = await createHotel();
        const currentRoom = await createRandomRoomWithHotelId(hotel.id);
        const booking = await createBooking(user.id, currentRoom.id);
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${booking.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket with TicketType.isRemote = true", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeRemote();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const currentRoom = await createRandomRoomWithHotelId(hotel.id);
        const booking = await createBooking(user.id, currentRoom.id);
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${booking.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket with TicketType.includesHotel = false", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithoutHotel();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

        const hotel = await createHotel();
        const currentRoom = await createRandomRoomWithHotelId(hotel.id);
        const booking = await createBooking(user.id, currentRoom.id);
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${booking.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      it("should respond with status 402 when user owns a ticket not paid", async () => {
        const user = await createUser();
        const token = await generateValidToken(user);
        const enrollment = await createEnrollmentWithAddress(user);
        const ticketType = await createTicketTypeWithHotel();
        await createTicket(enrollment.id, ticketType.id, TicketStatus.RESERVED);

        const hotel = await createHotel();
        const currentRoom = await createRandomRoomWithHotelId(hotel.id);
        const booking = await createBooking(user.id, currentRoom.id);
        const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

        const response = await server
          .put(`/booking/${booking.id}`)
          .set("Authorization", `Bearer ${token}`)
          .send({ roomId: roomToUpdate.id });

        expect(response.status).toEqual(httpStatus.PAYMENT_REQUIRED);
      });

      describe("when user owns a valid ticket", () => {
        it("should respond with status 404 when given roomId does not exists", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const currentRoom = await createRandomRoomWithHotelId(hotel.id);
          const booking = await createBooking(user.id, currentRoom.id);

          const response = await server
            .put(`/booking/${booking.id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: faker.datatype.number() });

          expect(response.status).toEqual(httpStatus.NOT_FOUND);
        });

        it("should respond with status 403 when inserted room is not vacant", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const currentRoom = await createRandomRoomWithHotelId(hotel.id);
          const booking = await createBooking(user.id, currentRoom.id);
          const roomToUpdate = await createOccupiedRoomWithHotelId(hotel.id);

          const response = await server
            .put(`/booking/${booking.id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: roomToUpdate.id });

          expect(response.status).toEqual(httpStatus.FORBIDDEN);
        });

        it("should respond with status 200 and change roomId in booking", async () => {
          const user = await createUser();
          const token = await generateValidToken(user);
          const enrollment = await createEnrollmentWithAddress(user);
          const ticketType = await createTicketTypeWithHotel();
          await createTicket(enrollment.id, ticketType.id, TicketStatus.PAID);

          const hotel = await createHotel();
          const currentRoom = await createRandomRoomWithHotelId(hotel.id);
          const booking = await createBooking(user.id, currentRoom.id);
          const roomToUpdate = await createRandomRoomWithHotelId(hotel.id);

          const response = await server
            .put(`/booking/${booking.id}`)
            .set("Authorization", `Bearer ${token}`)
            .send({ roomId: roomToUpdate.id });

          expect(response.status).toEqual(httpStatus.OK);
          expect(response.body).toEqual({
            bookingId: booking.id.toString(),
          });

          const updatedBooking = await prisma.booking.findUnique({
            where: {
              id: booking.id,
            },
          });

          expect(updatedBooking.roomId).toBe(roomToUpdate.id);
        });
      });
    });
  });
});
