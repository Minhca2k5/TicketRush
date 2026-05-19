package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.Optional;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    Optional<Event> findByNameIgnoreCase(String name);
    long countByVenueId(UUID venueId);

    @Query("""
        SELECT e FROM Event e
        WHERE (:keyword IS NULL OR LOWER(e.name) LIKE LOWER(CONCAT('%', :keyword, '%'))
               OR LOWER(e.description) LIKE LOWER(CONCAT('%', :keyword, '%'))
               OR LOWER(e.location) LIKE LOWER(CONCAT('%', :keyword, '%'))
               OR LOWER(e.organizer) LIKE LOWER(CONCAT('%', :keyword, '%')))
          AND (:category IS NULL OR LOWER(e.category) = LOWER(:category))
          AND (:fromDate IS NULL OR e.startTime >= :fromDate)
          AND (:toDate IS NULL OR e.startTime <= :toDate)
        ORDER BY e.startTime ASC
    """)
    List<Event> searchEvents(
            @Param("keyword") String keyword,
            @Param("category") String category,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate
    );
}
