package com.ticketrush.bookingservice.entity;

import jakarta.persistence.*;
import lombok.Data;

@Entity
@Table(name = "tickets")
@Data
public class Ticket {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private Order order;

    @Column(name = "seat_id", nullable = false)
    private Long seatId;

    @Column(name = "qr_code_token", unique = true, nullable = false)
    private String qrCodeToken;
}
