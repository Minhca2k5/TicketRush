package com.ticketrush.queueservice.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Entity
@Table(name = "queue_entries")
@Data
public class QueueEntry {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "event_id", nullable = false)
    private Long eventId;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false)
    private String status; // "WAITING" or "ALLOWED_TO_ENTER"

    @Column(name = "entered_at", nullable = false)
    private LocalDateTime enteredAt;

    @PrePersist
    protected void onCreate() {
        enteredAt = LocalDateTime.now();
    }
}
