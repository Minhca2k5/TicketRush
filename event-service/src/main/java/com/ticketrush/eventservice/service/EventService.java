package com.ticketrush.eventservice.service;

import com.ticketrush.eventservice.dto.*;
import com.ticketrush.eventservice.entity.Event;
import com.ticketrush.eventservice.entity.Seat;
import com.ticketrush.eventservice.entity.VenueZone;
import com.ticketrush.eventservice.entity.PriceTier;
import com.ticketrush.eventservice.repository.EventRepository;
import com.ticketrush.eventservice.repository.SeatRepository;
import com.ticketrush.eventservice.repository.VenueZoneRepository;
import com.ticketrush.eventservice.repository.PriceTierRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EventService {

    private final EventRepository eventRepository;
    private final SeatRepository seatRepository;
    private final VenueZoneRepository venueZoneRepository;
    private final PriceTierRepository priceTierRepository;

    public EventDTO createEvent(EventDTO eventDTO) {
        Event event = mapToEntity(eventDTO);
        Event savedEvent = eventRepository.save(event);
        return mapToDTO(savedEvent);
    }

    public EventDTO getEventById(Long id) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        return mapToDTO(event);
    }

    public List<EventSummaryDTO> getAllEvents() {
        return eventRepository.findAll().stream()
                .map(this::mapToSummaryDTO)
                .collect(Collectors.toList());
    }

    public DashboardSummaryDTO getDashboardSummary() {
        List<Seat> seats = seatRepository.findAll();
        long soldSeats = seats.stream().filter(seat -> "SOLD".equalsIgnoreCase(seat.getStatus())).count();
        long lockedSeats = seats.stream().filter(seat -> "LOCKED".equalsIgnoreCase(seat.getStatus())).count();
        long availableSeats = seats.stream().filter(seat -> "AVAILABLE".equalsIgnoreCase(seat.getStatus())).count();
        double estimatedRevenue = seats.stream()
                .filter(seat -> "SOLD".equalsIgnoreCase(seat.getStatus()))
                .filter(seat -> seat.getPriceTier() != null && seat.getPriceTier().getPrice() != null)
                .mapToDouble(seat -> seat.getPriceTier().getPrice())
                .sum();

        DashboardSummaryDTO dto = new DashboardSummaryDTO();
        dto.setEventCount(eventRepository.count());
        dto.setSeatCount(seats.size());
        dto.setAvailableSeats(availableSeats);
        dto.setLockedSeats(lockedSeats);
        dto.setSoldSeats(soldSeats);
        dto.setEstimatedRevenue(estimatedRevenue);
        dto.setOccupancyRate(seats.isEmpty() ? 0 : (soldSeats * 100.0 / seats.size()));
        return dto;
    }

    public EventDTO updateEvent(Long id, EventDTO eventDTO) {
        Event event = eventRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Event not found"));
        event.setName(eventDTO.getName());
        event.setDescription(eventDTO.getDescription());
        event.setLocation(eventDTO.getLocation());
        event.setStartTime(eventDTO.getStartTime());
        event.setImageUrl(eventDTO.getImageUrl());
        Event updatedEvent = eventRepository.save(event);
        return mapToDTO(updatedEvent);
    }

    public void deleteEvent(Long id) {
        eventRepository.deleteById(id);
    }

    public List<SeatDTO> getSeatMap(Long eventId) {
        List<Seat> seats = seatRepository.findAll().stream()
                .filter(seat -> seat.getEvent() != null && seat.getEvent().getId().equals(eventId))
                .collect(Collectors.toList());
        return seats.stream()
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());
    }

    private Event mapToEntity(EventDTO dto) {
        Event event = new Event();
        event.setName(dto.getName());
        event.setDescription(dto.getDescription());
        event.setLocation(dto.getLocation());
        event.setStartTime(dto.getStartTime());
        event.setImageUrl(dto.getImageUrl());
        return event;
    }

    private EventSummaryDTO mapToSummaryDTO(Event event) {
        EventSummaryDTO dto = new EventSummaryDTO();
        dto.setId(event.getId());
        dto.setName(event.getName());
        dto.setDescription(event.getDescription());
        dto.setLocation(event.getLocation());
        dto.setStartTime(event.getStartTime());
        dto.setImageUrl(event.getImageUrl());
        return dto;
    }

    private EventDTO mapToDTO(Event event) {
        List<SeatDTO> seatDTOs = seatRepository.findAll().stream()
                .filter(seat -> seat.getEvent() != null && seat.getEvent().getId().equals(event.getId()))
                .map(this::mapSeatToDTO)
                .collect(Collectors.toList());

        EventDTO dto = new EventDTO();
        dto.setId(event.getId());
        dto.setName(event.getName());
        dto.setDescription(event.getDescription());
        dto.setLocation(event.getLocation());
        dto.setStartTime(event.getStartTime());
        dto.setImageUrl(event.getImageUrl());
        dto.setSeats(seatDTOs);
        return dto;
    }

    private SeatDTO mapSeatToDTO(Seat seat) {
        SeatDTO dto = new SeatDTO();
        dto.setId(seat.getId());
        dto.setSeatNumber(seat.getSeatNumber());
        dto.setStatus(seat.getStatus());

        if (seat.getVenueZone() != null) {
            VenueZoneDTO zoneDTO = new VenueZoneDTO();
            zoneDTO.setId(seat.getVenueZone().getId());
            zoneDTO.setName(seat.getVenueZone().getName());
            zoneDTO.setDescription(seat.getVenueZone().getDescription());
            dto.setVenueZone(zoneDTO);
        }

        if (seat.getPriceTier() != null) {
            PriceTierDTO priceTierDTO = new PriceTierDTO();
            priceTierDTO.setId(seat.getPriceTier().getId());
            priceTierDTO.setName(seat.getPriceTier().getName());
            priceTierDTO.setPrice(seat.getPriceTier().getPrice());
            dto.setPriceTier(priceTierDTO);
        }

        return dto;
    }
}
