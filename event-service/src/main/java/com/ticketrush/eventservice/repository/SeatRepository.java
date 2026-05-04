package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Long> {
    List<Seat> findByEventId(Long eventId);
    List<Seat> findByVenueZoneId(Long venueZoneId);
    Optional<Seat> findByIdAndEventId(Long id, Long eventId);
    List<Seat> findByEventIdAndStatusAndLockExpiresAtBefore(Long eventId, String status, LocalDateTime lockExpiresAt);
    boolean existsByVenueZoneId(Long venueZoneId);
    boolean existsByPriceTierId(Long priceTierId);
}
