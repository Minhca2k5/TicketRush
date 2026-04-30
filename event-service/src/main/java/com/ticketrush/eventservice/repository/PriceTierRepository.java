package com.ticketrush.eventservice.repository;

import com.ticketrush.eventservice.entity.PriceTier;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.Optional;

@Repository
public interface PriceTierRepository extends JpaRepository<PriceTier, Long> {
    Optional<PriceTier> findByName(String name);
    PriceTier findByNameIgnoreCase(String name);
}
