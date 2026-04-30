package com.ticketrush.eventservice.controller;

import com.ticketrush.eventservice.dto.EventDTO;
import com.ticketrush.eventservice.dto.EventSummaryDTO;
import com.ticketrush.eventservice.dto.SeatDTO;
import com.ticketrush.eventservice.dto.SeatCreationRequest;
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
    public List<EventSummaryDTO> getAllEvents() {
        return eventService.getAllEvents();
    }

    @GetMapping("/{id}")
    public EventDTO getEventById(@PathVariable Long id) {
        return eventService.getEventById(id);
    }

    @PostMapping
    public EventDTO createEvent(@RequestBody EventDTO eventDTO) {
        return eventService.createEvent(eventDTO);
    }

    @PutMapping("/{id}")
    public EventDTO updateEvent(@PathVariable Long id, @RequestBody EventDTO eventDTO) {
        return eventService.updateEvent(id, eventDTO);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteEvent(@PathVariable Long id) {
        eventService.deleteEvent(id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/seats")
    public List<SeatDTO> getSeatMap(@PathVariable Long id) {
        return eventService.getSeatMap(id);
    }

    @PostMapping("/{id}/seats/batch")
    public ResponseEntity<Void> createSeatsBatch(@PathVariable Long id, @RequestBody SeatCreationRequest request) {
        request.setEventId(id);
        seatService.createSeatsForEvent(request);
        return ResponseEntity.ok().build();
    }
}
