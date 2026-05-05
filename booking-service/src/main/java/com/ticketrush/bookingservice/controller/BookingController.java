package com.ticketrush.bookingservice.controller;

import com.ticketrush.bookingservice.dto.*;
import com.ticketrush.bookingservice.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/booking")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService bookingService;

    @PostMapping("/lock")
    public ResponseEntity<ApiResponse<SeatDTO>> lockSeat(@RequestBody BookingRequestDTO request) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new RuntimeException("Seat ID is required for locking");
        }
        SeatDTO lockedSeat = bookingService.lockSeat(
                request.getEventId(),
                request.getSeatIds().get(0),
                request.getHolderId(),
                request.getHoldMinutes()
        );
        return ResponseEntity.ok(ApiResponse.success("Seat locked successfully", lockedSeat));
    }

    @PostMapping("/release")
    public ResponseEntity<ApiResponse<SeatDTO>> releaseSeat(@RequestBody BookingRequestDTO request) {
        if (request.getSeatIds() == null || request.getSeatIds().isEmpty()) {
            throw new RuntimeException("Seat ID is required for releasing");
        }
        SeatDTO releasedSeat = bookingService.releaseSeat(
                request.getEventId(),
                request.getSeatIds().get(0),
                request.getHolderId()
        );
        return ResponseEntity.ok(ApiResponse.success("Seat released successfully", releasedSeat));
    }

    @PostMapping("/checkout")
    public ResponseEntity<ApiResponse<OrderDTO>> checkout(@RequestBody CheckoutRequestDTO request) {
        OrderDTO order = bookingService.checkout(request);
        return ResponseEntity.ok(ApiResponse.success("Checkout completed successfully", order));
    }

    @GetMapping("/orders/{userId}")
    public ResponseEntity<ApiResponse<java.util.List<OrderDTO>>> getUserOrders(@PathVariable String userId) {
        java.util.List<OrderDTO> orders = bookingService.getUserOrders(userId);
        return ResponseEntity.ok(ApiResponse.success("Orders fetched successfully", orders));
    }
}
