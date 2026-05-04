package com.ticketrush.eventservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "venue_zones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class VenueZone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String description;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venue_id")
    private Venue venue;

    @OneToMany(mappedBy = "venueZone", cascade = CascadeType.ALL)
    private List<Seat> seats;
}
