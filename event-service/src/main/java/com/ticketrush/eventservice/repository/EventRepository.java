package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.Event;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface EventRepository extends JpaRepository<Event, Long> {
    Optional<Event> findByNameIgnoreCase(String name);
    long countByVenueId(UUID venueId);

    @Query("""
            select e from Event e
            where e.endTime is not null
              and e.endTime <= :now
              and (
                    e.status is null
                    or upper(e.status) not in ('PAST', 'ENDED', 'COMPLETED')
                  )
            """)
    List<Event> findEventsReadyToClose(@Param("now") LocalDateTime now);
}
