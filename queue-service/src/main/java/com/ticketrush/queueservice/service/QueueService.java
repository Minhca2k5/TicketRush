package com.ticketrush.queueservice.service;

import com.ticketrush.queueservice.dto.QueueStatusDTO;
import com.ticketrush.queueservice.entity.QueueEntry;
import com.ticketrush.queueservice.repository.QueueEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class QueueService {

    private final QueueEntryRepository queueRepository;

    @Transactional
    public QueueStatusDTO joinQueue(Long eventId, String userId) {
        Optional<QueueEntry> existing = queueRepository.findByEventIdAndUserId(eventId, userId);
        QueueEntry entry;
        
        if (existing.isPresent()) {
            entry = existing.get();
        } else {
            long waitingCount = queueRepository.countByEventIdAndStatus(eventId, "WAITING");
            
            entry = new QueueEntry();
            entry.setEventId(eventId);
            entry.setUserId(userId);
            // If no one is waiting, let them in immediately
            entry.setStatus(waitingCount == 0 ? "ALLOWED_TO_ENTER" : "WAITING");
            entry = queueRepository.save(entry);
        }

        return getStatus(eventId, userId);
    }

    public QueueStatusDTO getStatus(Long eventId, String userId) {
        QueueEntry entry = queueRepository.findByEventIdAndUserId(eventId, userId)
                .orElseThrow(() -> new RuntimeException("User is not in the queue"));

        QueueStatusDTO status = new QueueStatusDTO();
        status.setStatus(entry.getStatus());

        if ("ALLOWED_TO_ENTER".equals(entry.getStatus())) {
            status.setPosition(0);
            status.setEstimatedWaitMinutes(0);
        } else {
            long position = queueRepository.countUsersAheadInQueue(eventId, entry.getId());
            status.setPosition(position + 1);
            // Rough estimation: 50 users processed per minute
            status.setEstimatedWaitMinutes((position / 50) + 1);
        }

        return status;
    }

    // Every 15 seconds, allow up to 50 more users into the event
    @Scheduled(fixedRate = 15000)
    @Transactional
    public void admitUsers() {
        List<QueueEntry> waiting = queueRepository.findTop100ByStatusOrderByEnteredAtAsc("WAITING");
        for (QueueEntry entry : waiting) {
            entry.setStatus("ALLOWED_TO_ENTER");
        }
        queueRepository.saveAll(waiting);
    }
}
