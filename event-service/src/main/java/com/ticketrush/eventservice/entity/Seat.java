package com.ticketrush.eventservice.entity;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "seats")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Seat {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String seatNumber;
    private String rowName;
    private String status;
    private String lockHolder;
    private LocalDateTime lockExpiresAt;

    @Column(precision = 10, scale = 2)
    private BigDecimal coordinateX;

    @Column(precision = 10, scale = 2)
    private BigDecimal coordinateY;

    @ManyToOne
    @JoinColumn(name = "event_id")
    private Event event;

    @ManyToOne
    @JoinColumn(name = "venue_zone_id")
    private VenueZone venueZone;

    @ManyToOne
    @JoinColumn(name = "price_tier_id")
    private PriceTier priceTier;
}
