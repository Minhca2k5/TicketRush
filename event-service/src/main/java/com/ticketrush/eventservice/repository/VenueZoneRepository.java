package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.VenueZone;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface VenueZoneRepository extends JpaRepository<VenueZone, Long> {
    List<VenueZone> findByVenueId(UUID venueId);
    Optional<VenueZone> findByVenueIdAndNameIgnoreCase(UUID venueId, String name);
    Optional<VenueZone> findByName(String name);
    VenueZone findByNameIgnoreCase(String name);
}
