package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.EventPriceTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface EventPriceTierRepository extends JpaRepository<EventPriceTier, UUID> {
    List<EventPriceTier> findByEventId(Long eventId);
}
