package com.ticketrush.eventservice.entity;

import jakarta.persistence.*;
import lombok.*;
import java.util.List;

@Entity
@Table(name = "price_tiers")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class PriceTier {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private Double price;

    @OneToMany(mappedBy = "priceTier", cascade = CascadeType.ALL)
    private List<Seat> seats;
}
