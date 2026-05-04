package com.ticketrush.eventservice.controller;

import com.ticketrush.eventservice.dto.ApiResponse;
import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventSummaryDTO;
import com.ticketrush.eventservice.dto.SeatMapLayoutDTO;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
import com.ticketrush.eventservice.dto.SeatLockRequestDTO;
import com.ticketrush.eventservice.dto.SeatPurchaseRequestDTO;
import com.ticketrush.eventservice.dto.SeatReleaseRequestDTO;
import com.ticketrush.eventservice.service.EventService;
import com.ticketrush.eventservice.service.SeatService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
public class EventController {

    private final EventService eventService;
    private final SeatService seatService;

    public EventController(EventService eventService, SeatService seatService) {
        this.eventService = eventService;
        this.seatService = seatService;
    }

    @GetMapping
    public ResponseEntity<ApiResponse<List<EventSummaryDTO>>> getAllEvents() {
        return ResponseEntity.ok(ApiResponse.success("Events fetched successfully", eventService.getAllEvents()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDTO>> getEventById(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Event fetched successfully", eventService.getEventById(id)));
    }

    @PostMapping
    public ResponseEntity<ApiResponse<EventDTO>> createEvent(@RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(ApiResponse.success("Event created successfully", eventService.createEvent(eventDTO)));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ApiResponse<EventDTO>> updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO) {
        return ResponseEntity.ok(ApiResponse.success("Event updated successfully", eventService.updateEvent(id, eventDTO)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<ApiResponse<Void>> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.ok(ApiResponse.success("Event deleted successfully", null));
    }

    @GetMapping("/{id}/seats")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> getSeatMap(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat map fetched successfully", eventService.getSeatMap(id)));
    }

    @GetMapping("/{id}/seat-map")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> getSeatMapAlias(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat map fetched successfully", eventService.getSeatMap(id)));
    }

    @GetMapping("/{id}/seat-layout")
    public ResponseEntity<ApiResponse<SeatMapLayoutDTO>> getSeatMapLayout(@PathVariable Long id) {
        return ResponseEntity.ok(ApiResponse.success("Seat layout fetched successfully", eventService.getSeatMapLayout(id)));
    }

    @PostMapping("/{eventId}/seats/{seatId}/lock")
    public ResponseEntity<ApiResponse<SeatDTO>> lockSeat(
            @PathVariable Long eventId,
            @PathVariable Long seatId,
            @RequestBody SeatLockRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seat locked successfully",
                seatService.lockSeat(eventId, seatId, request.getHolderId(), request.getHoldMinutes())
        ));
    }

    @PostMapping("/{eventId}/seats/{seatId}/release")
    public ResponseEntity<ApiResponse<SeatDTO>> releaseSeat(
            @PathVariable Long eventId,
            @PathVariable Long seatId,
            @RequestBody SeatReleaseRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seat released successfully",
                seatService.releaseSeat(eventId, seatId, request.getHolderId())
        ));
    }

    @PostMapping("/{eventId}/seats/purchase")
    public ResponseEntity<ApiResponse<List<SeatDTO>>> purchaseSeats(
            @PathVariable Long eventId,
            @RequestBody SeatPurchaseRequestDTO request
    ) {
        return ResponseEntity.ok(ApiResponse.success(
                "Seats purchased successfully",
                seatService.purchaseSeats(eventId, request.getSeatIds(), request.getHolderId())
        ));
    }

    @PostMapping("/{id}/seats/batch")
    public ResponseEntity<Void> createSeatsBatch(@PathVariable Long id, @RequestBody SeatCreationRequest request) {
        request.setEventId(id);
        seatService.createSeatsForEvent(request);
        return ResponseEntity.ok().build();
    }
}
