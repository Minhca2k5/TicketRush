package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.Seat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import jakarta.persistence.LockModeType;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface SeatRepository extends JpaRepository<Seat, Long> {
    List<Seat> findByStatus(String status);
    List<Seat> findByEventId(Long eventId);
    List<Seat> findByVenueZoneId(Long venueZoneId);
    Optional<Seat> findByIdAndEventId(Long id, Long eventId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT s FROM Seat s WHERE s.id = :id AND s.event.id = :eventId")
    Optional<Seat> findAndLockByIdAndEventId(@Param("id") Long id, @Param("eventId") Long eventId);

    List<Seat> findByEventIdAndStatusAndLockExpiresAtBefore(Long eventId, String status, LocalDateTime lockExpiresAt);
    boolean existsByVenueZoneId(Long venueZoneId);
    boolean existsByPriceTierId(Long priceTierId);
}
