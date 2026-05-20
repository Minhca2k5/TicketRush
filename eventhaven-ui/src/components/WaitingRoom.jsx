import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuthToken } from '../lib/auth';
import { joinQueue, getQueueStatus } from '../services/queueService';

export function WaitingRoom({ eventId, onAdmit }) {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const admitRef = useRef(onAdmit);
  const admittedRef = useRef(false);

  useEffect(() => {
    admitRef.current = onAdmit;
  }, [onAdmit]);

  useEffect(() => {
    let active = true;
    let intervalId;

    const admit = () => {
      if (!active || admittedRef.current) return;
      admittedRef.current = true;
      window.sessionStorage.setItem(`ticketrush-admitted-${eventId}`, 'true');
      admitRef.current();
    };

    const applyStatus = (nextStatus) => {
      if (!active) return;
      setStatus(nextStatus);
      setError(null);
      if (nextStatus.status === 'ALLOWED_TO_ENTER') {
        admit();
      }
    };

    const loadQueue = async () => {
      if (!getAuthToken()) {
        setError('Please sign in before entering the waiting room.');
        return;
      }

      try {
        const joined = await joinQueue(eventId);
        applyStatus(joined);
        if (joined.status === 'ALLOWED_TO_ENTER') {
          return;
        }
      } catch (err) {
        if (active) setError(err.response?.data?.message || err.response?.data?.error || 'Could not join the waiting room.');
        return;
      }

      intervalId = window.setInterval(async () => {
        try {
          const nextStatus = await getQueueStatus(eventId);
          applyStatus(nextStatus);
          if (nextStatus.status === 'ALLOWED_TO_ENTER') {
            window.clearInterval(intervalId);
          }
        } catch (err) {
          if (active) setError(err.response?.data?.message || err.response?.data?.error || 'Could not refresh your queue status.');
        }
      }, 3000);
    };

    loadQueue();

    return () => {
      active = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
    };
  }, [eventId]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="text-4xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-800">Connection Error</h2>
        <p className="text-slate-500 mt-2">{error}</p>
        <button
          onClick={() => (getAuthToken() ? window.location.reload() : navigate('/login'))}
          className="mt-6 px-6 py-2 bg-violet-600 text-white rounded-full font-bold shadow-lg"
        >
          {getAuthToken() ? 'Try Again' : 'Sign In'}
        </button>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-medium">Entering Virtual Waiting Room...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl border border-slate-100 p-8 relative overflow-hidden">
        {/* Animated Background Ring */}
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center pointer-events-none opacity-20">
            <div className="w-64 h-64 border-8 border-violet-500 rounded-full animate-ping"></div>
        </div>

        <div className="relative z-10">
          <div className="text-6xl mb-6 animate-bounce">⏳</div>
          <h2 className="text-2xl font-black text-slate-900 mb-2">You are in line</h2>
          <p className="text-slate-500 mb-8">
            Due to high demand, you have been placed in a virtual waiting room. Please do not refresh this page.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 space-y-4">
            <div>
              <p className="text-sm font-bold text-slate-500 uppercase tracking-wider">People ahead of you</p>
              <p className="text-5xl font-black text-violet-600 mt-1">{status.position || 0}</p>
            </div>
            {status.estimatedWaitMinutes > 0 && (
              <div className="pt-4 border-t border-slate-200">
                <p className="text-sm font-medium text-slate-600">
                  Estimated wait time: <span className="font-bold text-slate-900">~{status.estimatedWaitMinutes} min</span>
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
