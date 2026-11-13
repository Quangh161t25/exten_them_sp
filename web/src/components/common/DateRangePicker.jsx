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

const MONTH_NAMES = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4',
  'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8',
  'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
];

function CalendarPanel({
  date,
  onChangeDate,
  viewMode,
  onChangeViewMode,
  tempStart,
  tempEnd,
  hoverDate,
  onSelectDay,
  onHoverDay,
}) {
  const year = date.getFullYear();
  const month = date.getMonth();

  // Decade calculation for years view
  const decadeStart = Math.floor(year / 10) * 10;
  const decadeEnd = decadeStart + 9;

  // Day view rendering
  if (viewMode === 'days') {
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
          onClick={() => onSelectDay(current)}
          onMouseEnter={() => onHoverDay(current)}
        >
          {d}
        </button>
      );
    }

    return (
      <div className="dp-panel">
        <div className="dp-panel-header">
          <div className="dp-header-navs">
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => onChangeDate(new Date(year - 1, month, 1))}
              title="Năm trước"
            >
              «
            </button>
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => onChangeDate(new Date(year, month - 1, 1))}
              title="Tháng trước"
            >
              ‹
            </button>
          </div>
          <div className="dp-header-title">
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => onChangeViewMode('months')}
              title="Chọn tháng"
            >
              Tháng {month + 1}
            </button>
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => onChangeViewMode('years')}
              title="Chọn năm"
            >
              {year}
            </button>
          </div>
          <div className="dp-header-navs">
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => onChangeDate(new Date(year, month + 1, 1))}
              title="Tháng sau"
            >
              ›
            </button>
            <button
              type="button"
              className="dp-nav-btn"
              onClick={() => onChangeDate(new Date(year + 1, month, 1))}
              title="Năm sau"
            >
              »
            </button>
          </div>
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
  }

  // Month view rendering (Ảnh 2)
  if (viewMode === 'months') {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    return (
      <div className="dp-panel">
        <div className="dp-panel-header">
          <button
            type="button"
            className="dp-nav-btn"
            onClick={() => onChangeDate(new Date(year - 1, month, 1))}
            title="Năm trước"
          >
            «
          </button>
          <div className="dp-header-title">
            <button
              type="button"
              className="dp-title-btn"
              onClick={() => onChangeViewMode('years')}
              title="Chọn năm"
            >
              {year}
            </button>
          </div>
          <button
            type="button"
            className="dp-nav-btn"
            onClick={() => onChangeDate(new Date(year + 1, month, 1))}
            title="Năm sau"
          >
            »
          </button>
        </div>

        <div className="dp-month-grid">
          {MONTH_NAMES.map((name, idx) => {
            const isCurrent = currentYear === year && currentMonth === idx;
            const isStart = tempStart && tempStart.getFullYear() === year && tempStart.getMonth() === idx;
            const isEnd = tempEnd && tempEnd.getFullYear() === year && tempEnd.getMonth() === idx;

            let cls = 'dp-cell-btn';
            if (isStart || isEnd) cls += ' sel';
            else if (isCurrent) cls += ' on';

            return (
              <button
                key={idx}
                type="button"
                className={cls}
                onClick={() => {
                  onChangeDate(new Date(year, idx, 1));
                  onChangeViewMode('days');
                }}
              >
                {name}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // Year view rendering (Ảnh 3)
  if (viewMode === 'years') {
    const currentYear = new Date().getFullYear();
    const yearsList = [];
    for (let y = decadeStart; y <= decadeEnd; y++) {
      yearsList.push(y);
    }

    return (
      <div className="dp-panel">
        <div className="dp-panel-header">
          <button
            type="button"
            className="dp-nav-btn"
            onClick={() => onChangeDate(new Date(year - 10, month, 1))}
            title="10 năm trước"
          >
            «
          </button>
          <div className="dp-header-title">
            <span className="dp-title-text">
              {decadeStart} – {decadeEnd}
            </span>
          </div>
          <button
            type="button"
            className="dp-nav-btn"
            onClick={() => onChangeDate(new Date(year + 10, month, 1))}
            title="10 năm sau"
          >
            »
          </button>
        </div>

        <div className="dp-year-grid">
          {yearsList.map((y) => {
            const isCurrent = currentYear === y;
            const isStart = tempStart && tempStart.getFullYear() === y;
            const isEnd = tempEnd && tempEnd.getFullYear() === y;

            let cls = 'dp-cell-btn';
            if (isStart || isEnd) cls += ' sel';
            else if (isCurrent) cls += ' on';

            return (
              <button
                key={y}
                type="button"
                className={cls}
                onClick={() => {
                  onChangeDate(new Date(y, month, 1));
                  onChangeViewMode('months');
                }}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return null;
}

export default function DateRangePicker({ from = '', to = '', onChange, label: customLabel }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse initial dates
  const initialStart = useMemo(() => parseIso(from), [from]);
  const initialEnd = useMemo(() => parseIso(to), [to]);

  const [tempStart, setTempStart] = useState(initialStart);
  const [tempEnd, setTempEnd] = useState(initialEnd);
  const [hoverDate, setHoverDate] = useState(null);
  const [activePreset, setActivePreset] = useState(customLabel || '');

  // View modes: 'days' | 'months' | 'years'
  const [leftMode, setLeftMode] = useState('days');
  const [rightMode, setRightMode] = useState('days');

  // Month panels dates
  const [leftDate, setLeftDate] = useState(() => {
    if (initialStart) {
      return new Date(initialStart.getFullYear(), initialStart.getMonth(), 1);
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 1, 1);
  });

  const [rightDate, setRightDate] = useState(() => {
    if (initialStart) {
      const next = new Date(initialStart.getFullYear(), initialStart.getMonth() + 1, 1);
      if (initialEnd && (initialEnd.getFullYear() > next.getFullYear() || initialEnd.getMonth() > next.getMonth())) {
        return new Date(initialEnd.getFullYear(), initialEnd.getMonth(), 1);
      }
      return next;
    }
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  // Keep temp states in sync when props change
  useEffect(() => {
    setTempStart(parseIso(from));
    setTempEnd(parseIso(to));
    if (customLabel) {
      setActivePreset(customLabel);
    } else if (!from && !to) {
      setActivePreset('');
    }
  }, [from, to, customLabel]);

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

  // Quick ranges definition (matching Ảnh 2 & 3)
  const quickRanges = useMemo(() => {
    const now = new Date();
    const t = dayStart(now);

    return [
      { label: 'Hôm nay', from: t, to: t },
      { label: 'Hôm qua', from: addDays(t, -1), to: addDays(t, -1) },
      { label: '1 tuần qua', from: addDays(t, -6), to: t },
      { label: '1 tháng qua', from: addDays(t, -29), to: t },
      { label: '3 tháng qua', from: addDays(t, -89), to: t },
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

  const handleLeftDateChange = (newDate) => {
    setLeftDate(newDate);
    const minRight = new Date(newDate.getFullYear(), newDate.getMonth() + 1, 1);
    if (rightDate <= newDate) {
      setRightDate(minRight);
    }
  };

  const handleRightDateChange = (newDate) => {
    setRightDate(newDate);
    const maxLeft = new Date(newDate.getFullYear(), newDate.getMonth() - 1, 1);
    if (leftDate >= newDate) {
      setLeftDate(maxLeft);
    }
  };

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

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setLeftMode('days');
        setRightMode('days');
        setHoverDate(null);
        const start = parseIso(from);
        const end = parseIso(to);
        setTempStart(start);
        setTempEnd(end);
        if (start) {
          setLeftDate(new Date(start.getFullYear(), start.getMonth(), 1));
          if (end && (end.getFullYear() > start.getFullYear() || end.getMonth() > start.getMonth())) {
            setRightDate(new Date(end.getFullYear(), end.getMonth(), 1));
          } else {
            setRightDate(new Date(start.getFullYear(), start.getMonth() + 1, 1));
          }
        } else {
          const now = new Date();
          setLeftDate(new Date(now.getFullYear(), now.getMonth() - 1, 1));
          setRightDate(new Date(now.getFullYear(), now.getMonth(), 1));
        }
      }
      return next;
    });
  };

  return (
    <div className="dh-dd dp-wrap" ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        className={`dh-dd-btn ${from || to ? 'on' : ''}`}
        onClick={toggleOpen}
      >
        <Calendar size={14} />
        <span>{buttonLabel}</span>
      </button>

      {/* Popup Menu */}
      {open && (
        <div className="dp-pop">
          {/* Quick presets (left sidebar) */}
          <div className="dp-quick">
            {quickRanges.map((q) => {
              const isMatch =
                activePreset === q.label ||
                (!activePreset && customLabel === q.label) ||
                (!activePreset &&
                  !customLabel &&
                  q.from &&
                  q.to &&
                  toIso(q.from) === from &&
                  toIso(q.to) === to) ||
                (!activePreset && !customLabel && q.from === null && !from && !to);

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

          {/* Calendars area (right section with 2 panels) */}
          <div className="dp-cal" onMouseLeave={() => setHoverDate(null)}>
            <div className="dp-months">
              <CalendarPanel
                date={leftDate}
                onChangeDate={handleLeftDateChange}
                viewMode={leftMode}
                onChangeViewMode={setLeftMode}
                tempStart={tempStart}
                tempEnd={tempEnd}
                hoverDate={hoverDate}
                onSelectDay={handleSelectDay}
                onHoverDay={(d) => !tempEnd && setHoverDate(d)}
              />
              <CalendarPanel
                date={rightDate}
                onChangeDate={handleRightDateChange}
                viewMode={rightMode}
                onChangeViewMode={setRightMode}
                tempStart={tempStart}
                tempEnd={tempEnd}
                hoverDate={hoverDate}
                onSelectDay={handleSelectDay}
                onHoverDay={(d) => !tempEnd && setHoverDate(d)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
