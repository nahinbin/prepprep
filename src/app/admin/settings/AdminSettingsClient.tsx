"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { updateEconomySettings } from "@/app/actions/settings";
import type { EconomySettings } from "@/lib/constants";

export function AdminSettingsClient({ initial }: { initial: EconomySettings }) {
  const [settings, setSettings] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fields: Array<{ key: keyof EconomySettings; label: string; hint: string }> = [
    {
      key: "startingCoins",
      label: "Starting coins",
      hint: "Coins a new user gets on register",
    },
    {
      key: "coinsPerQuestionCost",
      label: "Session cost per question",
      hint: "Fallback cost when not using tier pricing",
    },
    {
      key: "coinsPerCorrect",
      label: "Coins per correct answer",
      hint: "Earned at end of paid sessions",
    },
    {
      key: "xpPerCorrect",
      label: "XP per correct answer",
      hint: "Positive XP gained",
    },
    {
      key: "xpPerWrong",
      label: "XP lost per wrong answer",
      hint: "Added to XP Lost",
    },
    {
      key: "redoXpRecovery",
      label: "XP recovered on redo clear",
      hint: "When a non-practice mistake is fully cleared",
    },
  ];

  const save = async () => {
    setLoading(true);
    setError("");
    setSaved(false);
    const res = await updateEconomySettings(settings);
    setLoading(false);
    if (!res.success) {
      setError("Failed to save.");
      return;
    }
    setSettings(res.settings);
    setSaved(true);
  };

  return (
    <Card className="w-full max-w-2xl p-6 rounded-2xl space-y-5">
      <div>
        <h2 className="text-xl font-bold">Economy settings</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Defaults stay in place until you change them here.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map(({ key, label, hint }) => (
          <div key={key}>
            <label className="text-sm font-semibold">{label}</label>
            <p className="text-xs text-muted-foreground mb-1.5">{hint}</p>
            <Input
              type="number"
              min={0}
              value={settings[key]}
              onChange={(e) =>
                setSettings((s) => ({ ...s, [key]: Number(e.target.value) }))
              }
              className="h-11 rounded-xl"
            />
          </div>
        ))}
      </div>

      {error && <p className="text-sm text-danger">{error}</p>}
      {saved && <p className="text-sm text-success">Saved.</p>}

      <Button className="w-full h-12 rounded-xl font-bold" onClick={save} isLoading={loading}>
        Save settings
      </Button>
    </Card>
  );
}
