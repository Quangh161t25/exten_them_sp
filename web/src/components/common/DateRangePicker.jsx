import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Calendar } from 'lucide-react';

const toIso = (d) => {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

const parseIso = (s) => {
  if (!s) return null;
  const parts = String(s).split('-');
  if (parts.length === 3) {
    return new Date(+parts[0], +parts[1] - 1, +parts[2]);
  }
  return null;
};

const fmtShort = (s) => {
  if (!s) return '';
  const parts = String(s).split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}`;
  }
  return s;
};

const dayStart = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export default function DateRangePicker({ from = '', to = '', onChange, label: customLabel }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial dates
  const initialStart = useMemo(() => parseIso(from), [from]);
  const initialEnd = useMemo(() => parseIso(to), [to]);

  const [tempStart, setTempStart] = useState(initialStart);
  const [tempEnd, setTempEnd] = useState(initialEnd);
  const [hoverDate, setHoverDate] = useState(null);
  const [activePreset, setActivePreset] = useState('');

  // Default month view (shows 2 months: viewMonth and viewMonth + 1)
  const [viewMonth, setViewMonth] = useState(() => {
    if (initialStart) {
      return new Date(initialStart.getFullYear(), initialStart.getMonth(), 1);
    }
    const now = new Date();
    // Default show current month - 1 and current month
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });

  // Keep temp states in sync when props change
  useEffect(() => {
    setTempStart(parseIso(from));
    setTempEnd(parseIso(to));
  }, [from, to]);

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  // Quick ranges definition
  const quickRanges = useMemo(() => {
    const now = new Date();
    const t = dayStart(now);
    const dow = (t.getDay() + 6) % 7; // Monday = 0, Sunday = 6
    const weekStart = addDays(t, -dow);
    const monthStart = new Date(t.getFullYear(), t.getMonth(), 1);
    const lastMonthStart = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const lastMonthEnd = addDays(monthStart, -1);

    return [
      { label: 'Hôm nay', from: t, to: t },
      { label: 'Hôm qua', from: addDays(t, -1), to: addDays(t, -1) },
      { label: 'Tuần này', from: weekStart, to: t },
      { label: 'Tuần trước', from: addDays(weekStart, -7), to: addDays(weekStart, -1) },
      { label: 'Tháng này', from: monthStart, to: t },
      { label: 'Tháng trước', from: lastMonthStart, to: lastMonthEnd },
      { label: 'Tất cả ngày', from: null, to: null },
    ];
  }, []);

  const handleApplyRange = (startDate, endDate, presetLabel = '') => {
    setActivePreset(presetLabel);
    setTempStart(startDate);
    setTempEnd(endDate);
    setOpen(false);
    if (onChange) {
      onChange(toIso(startDate), toIso(endDate), presetLabel);
    }
  };

  const handleSelectDay = (d) => {
    if (!tempStart || tempEnd) {
      // First click: select start date
      setTempStart(d);
      setTempEnd(null);
      setActivePreset('');
    } else {
      // Second click: select end date
      let start = tempStart;
      let end = d;
      if (end < start) {
        const swap = start;
        start = end;
        end = swap;
      }
      handleApplyRange(start, end, '');
    }
  };

  const handleNav = (months) => {
    setViewMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + months, 1));
  };

  // Next month
  const nextMonth = useMemo(() => {
    return new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1);
  }, [viewMonth]);

  // Display label on the trigger button
  const buttonLabel = useMemo(() => {
    if (customLabel) return customLabel;
    if (activePreset) return activePreset;
    if (from || to) {
      if (from === to) return fmtShort(from);
      return `${fmtShort(from) || '…'} → ${fmtShort(to) || '…'}`;
    }
    return 'Ngày đặt';
  }, [customLabel, activePreset, from, to]);

  const renderMonth = (m) => {
    const year = m.getFullYear();
    const month = m.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const today = dayStart(new Date()).getTime();

    const startTime = tempStart ? dayStart(tempStart).getTime() : null;
    const endTime = tempEnd ? dayStart(tempEnd).getTime() : null;
    const hoverTime = hoverDate ? dayStart(hoverDate).getTime() : null;

    const blanks = [];
    for (let i = 0; i < firstDay; i++) {
      blanks.push(<span key={`blank-${i}`} />);
    }

    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const current = new Date(year, month, d);
      const currentTime = current.getTime();

      const isToday = currentTime === today;
      const isStart = startTime && currentTime === startTime;
      const isEnd = endTime && currentTime === endTime;
      const isSelected = isStart || isEnd;

      let isInRange = false;
      let isHoverInRange = false;

      if (startTime && endTime) {
        isInRange = currentTime > startTime && currentTime < endTime;
      } else if (startTime && !endTime && hoverTime) {
        const min = Math.min(startTime, hoverTime);
        const max = Math.max(startTime, hoverTime);
        isHoverInRange = currentTime > min && currentTime < max;
      }

      let cls = 'dp-day';
      if (isToday) cls += ' today';
      if (isSelected) cls += ' sel';
      else if (isInRange) cls += ' in';
      else if (isHoverInRange) cls += ' hover-in';

      days.push(
        <button
          key={d}
          type="button"
          className={cls}
          onClick={() => handleSelectDay(current)}
          onMouseEnter={() => !tempEnd && setHoverDate(current)}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="dp-month">
        <div className="dp-title">
          Tháng {month + 1}/{year}
        </div>
        <div className="dp-grid">
          {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'].map((w) => (
            <b key={w}>{w}</b>
          ))}
          {blanks}
          {days}
        </div>
      </div>
    );
  };

  return (
    <div className="dh-dd dp-wrap" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`dh-dd-btn ${from || to ? 'on' : ''}`}
        onClick={() => {
          setOpen((v) => !v);
          setTempStart(parseIso(from));
          setTempEnd(parseIso(to));
          setHoverDate(null);
        }}
      >
        <Calendar size={14} />
        <span>{buttonLabel}</span>
      </button>

      {/* Popup Menu */}
      {open && (
        <div className="dh-dd-menu dp-pop">
          {/* Quick presets (left sidebar) */}
          <div className="dp-quick">
            {quickRanges.map((q) => {
              const isMatch =
                activePreset === q.label ||
                (!activePreset &&
                  q.from &&
                  q.to &&
                  toIso(q.from) === from &&
                  toIso(q.to) === to) ||
                (q.from === null && !from && !to);

              return (
                <button
                  key={q.label}
                  type="button"
                  className={isMatch ? 'on' : ''}
                  onClick={() => handleApplyRange(q.from, q.to, q.label)}
                >
                  {q.label}
                </button>
              );
            })}
          </div>

          {/* Calendar section (right area) */}
          <div className="dp-cal">
            <div className="dp-nav">
              <button
                type="button"
                onClick={() => handleNav(-12)}
                title="Lùi 1 năm"
              >
                «
              </button>
              <button
                type="button"
                onClick={() => handleNav(-1)}
                title="Lùi 1 tháng"
              >
                ‹
              </button>
              <span>
                {tempStart && !tempEnd
                  ? 'Chọn ngày kết thúc'
                  : 'Chọn ngày bắt đầu'}
              </span>
              <button
                type="button"
                onClick={() => handleNav(1)}
                title="Tiến 1 tháng"
              >
                ›
              </button>
              <button
                type="button"
                onClick={() => handleNav(12)}
                title="Tiến 1 năm"
              >
                »
              </button>
            </div>

            <div className="dp-months">
              {renderMonth(viewMonth)}
              {renderMonth(nextMonth)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
