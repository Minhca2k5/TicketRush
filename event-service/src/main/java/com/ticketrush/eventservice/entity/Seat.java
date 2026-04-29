package com.ticketrush.eventservice.entity;

import jakarta.persistence.*;
import lombok.*;

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

    private String seatNumber; // Ví dụ: A1, B5

    // Trạng thái ghế: AVAILABLE (Trống), LOCKED (Đang giữ), SOLD (Đã bán)
    private String status;

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