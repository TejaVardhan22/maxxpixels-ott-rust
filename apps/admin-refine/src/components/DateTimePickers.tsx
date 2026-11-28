import React from "react";
import { DatePicker, TimePicker } from "antd";
import dayjs from "dayjs";

interface PickerProps {
  value?: string | number | null;
  onChange?: (val: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
  disabled?: boolean;
}

function secondsToHMS(total: number): string {
  const s = Math.max(0, Math.floor(total));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((n) => String(n).padStart(2, "0")).join(":");
}

/** Calendar-only picker emitting YYYY-MM-DD strings */
export const CalendarDatePicker: React.FC<PickerProps> = ({
  value,
  onChange,
  placeholder = "Select date",
  style,
  disabled,
}) => {
  const parsed = value ? dayjs(String(value).slice(0, 10), "YYYY-MM-DD") : null;
  return (
    <DatePicker
      value={parsed && parsed.isValid() ? parsed : null}
      onChange={(d) => onChange?.(d ? d.format("YYYY-MM-DD") : "")}
      format="YYYY-MM-DD"
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: "100%", ...style }}
      allowClear
    />
  );
};

/** Calendar + Timer picker emitting YYYY-MM-DDTHH:mm strings */
export const CalendarDateTimePicker: React.FC<PickerProps> = ({
  value,
  onChange,
  placeholder = "Select date & time",
  style,
  disabled,
}) => {
  const parsed = value ? dayjs(String(value)) : null;
  return (
    <DatePicker
      showTime={{ format: "HH:mm" }}
      value={parsed && parsed.isValid() ? parsed : null}
      onChange={(d) => onChange?.(d ? d.format("YYYY-MM-DDTHH:mm") : "")}
      format="YYYY-MM-DD HH:mm"
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: "100%", ...style }}
      allowClear
    />
  );
};

/** Timer-only picker emitting HH:mm:ss strings (also accepts numeric seconds) */
export const TimerPicker: React.FC<PickerProps> = ({
  value,
  onChange,
  placeholder = "HH:MM:SS",
  style,
  disabled,
}) => {
  let strVal = "";
  if (typeof value === "number" && !Number.isNaN(value) && value > 0) {
    strVal = secondsToHMS(value);
  } else if (typeof value === "string" && value.trim()) {
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
      strVal = secondsToHMS(Number(trimmed));
    } else if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(trimmed)) {
      const parts = trimmed.split(":");
      strVal =
        parts.length === 2
          ? `00:${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}`
          : `${parts[0].padStart(2, "0")}:${parts[1].padStart(2, "0")}:${parts[2].padStart(2, "0")}`;
    }
  }
  const parsed = strVal ? dayjs(strVal, "HH:mm:ss") : null;
  return (
    <TimePicker
      value={parsed && parsed.isValid() ? parsed : null}
      onChange={(d) => onChange?.(d ? d.format("HH:mm:ss") : "")}
      format="HH:mm:ss"
      showNow={false}
      needConfirm={false}
      placeholder={placeholder}
      disabled={disabled}
      style={{ width: "100%", ...style }}
      allowClear
    />
  );
};
