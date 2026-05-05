package com.ticketrush.queueservice.repository;

import com.ticketrush.queueservice.entity.QueueEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QueueEntryRepository extends JpaRepository<QueueEntry, Long> {
    Optional<QueueEntry> findByEventIdAndUserId(Long eventId, String userId);
    
    long countByEventIdAndStatus(Long eventId, String status);
    
    @Query("SELECT COUNT(q) FROM QueueEntry q WHERE q.eventId = :eventId AND q.status = 'WAITING' AND q.enteredAt < (SELECT innerQ.enteredAt FROM QueueEntry innerQ WHERE innerQ.id = :entryId)")
    long countUsersAheadInQueue(Long eventId, Long entryId);

    List<QueueEntry> findTop100ByEventIdAndStatusOrderByEnteredAtAsc(Long eventId, String status);
    List<QueueEntry> findTop100ByStatusOrderByEnteredAtAsc(String status);
}
