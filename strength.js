"use strict";

// Die Eingabe ist der für die Sortierung maßgebliche Mittendurchmesser in cm.
function strengthClass(diameterCm)
{
    if (!Number.isFinite(diameterCm) || diameterCm <= 0)
    {
        return null;
    }
    if (diameterCm < 10)
    {
        return "0";
    }
    if (diameterCm < 15)
    {
        return "1a";
    }
    if (diameterCm < 20)
    {
        return "1b";
    }
    if (diameterCm < 25)
    {
        return "2a";
    }
    if (diameterCm < 30)
    {
        return "2b";
    }
    if (diameterCm < 35)
    {
        return "3a";
    }
    if (diameterCm < 40)
    {
        return "3b";
    }
    if (diameterCm < 50)
    {
        return "4";
    }
    if (diameterCm < 60)
    {
        return "5";
    }
    if (diameterCm < 70)
    {
        return "6";
    }
    if (diameterCm < 80)
    {
        return "7";
    }
    return "8";
}
