router.get("/summary", authenticateToken, async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - days);

    const { data: history, error } = await supabase
      .from('history')
      .select('stress_percent, emotion, created_at, text, feedback, stress_level')
      .eq('user_id', req.user.user_id)
      .gte('created_at', daysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (history.length === 0) {
      return res.json({
        averageStress: 0,
        emotionCounts: {},
        stressHistory: [],
        latestEmotion: '',
        latestEmotionTime: null,
        weeklyCount: 0,
        weeklyAverageStress: 'None', 
        totalCount: 0,
        mostCommonEmotion: 'No emotion entry',
        mostCommonStressLevel: 'None',
        tips: []
      });
    }

    const validStressEntries = history.filter(h => h.stress_percent !== null && h.stress_percent !== undefined);
    const totalStress = validStressEntries.reduce((sum, h) => sum + h.stress_percent, 0);
    const averageStress = validStressEntries.length > 0 ? Math.round(totalStress / validStressEntries.length) : 0;

    const emotionCounts = {};
    history.forEach((h) => {
      const emotion = h.emotion || "No emotion entry";
      emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1;
    });

    const stressLevelCounts = {};
    history.forEach((h) => {
      if (h.stress_level) {
        stressLevelCounts[h.stress_level] = (stressLevelCounts[h.stress_level] || 0) + 1;
      }
    });

    const mostCommonStressLevel = Object.keys(stressLevelCounts).length > 0 
      ? Object.keys(stressLevelCounts).reduce((a, b) => stressLevelCounts[a] > stressLevelCounts[b] ? a : b)
      : 'None';

    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weeklyEntries = history.filter(h => new Date(h.created_at) >= weekAgo);
    const weeklyCount = weeklyEntries.length;
    
    // Calculate most common stress level for this week instead of average percentage
    const weeklyStressLevelCounts = {};
    weeklyEntries.forEach((h) => {
      if (h.stress_level) {
        weeklyStressLevelCounts[h.stress_level] = (weeklyStressLevelCounts[h.stress_level] || 0) + 1;
      }
    });

    const weeklyAverageStress = Object.keys(weeklyStressLevelCounts).length > 0 
      ? Object.keys(weeklyStressLevelCounts).reduce((a, b) => weeklyStressLevelCounts[a] > weeklyStressLevelCounts[b] ? a : b)
      : 'None';

    const mostCommonEmotion = Object.keys(emotionCounts).length > 0 
      ? Object.keys(emotionCounts).reduce((a, b) => emotionCounts[a] > emotionCounts[b] ? a : b)
      : 'No emotion entry';

    const dailyData = {};
    const filteredHistory = history.filter(h => 
      h.stress_percent !== null && 
      h.stress_percent !== undefined
    );

    filteredHistory.forEach(h => {
      const date = new Date(h.created_at);
      const dateKey = date.toISOString().split('T')[0]; 
      
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { total: 0, count: 0 };
      }
      dailyData[dateKey].total += h.stress_percent;
      dailyData[dateKey].count += 1;
    });

    const stressHistory = [];
    const sortedDates = Object.keys(dailyData).sort();
    
    const maxPoints = days <= 7 ? 7 : days <= 30 ? 15 : 30;
    const recentDates = sortedDates.slice(-maxPoints);
    
    recentDates.forEach(date => {
      stressHistory.push({
        date: date,
        value: Math.round(dailyData[date].total / dailyData[date].count)
      });
    });

    const latestEntry = history[0];
    const latestEmotion = latestEntry?.emotion || '';
    const latestEmotionTime = latestEntry?.created_at;

    const tips = [];
    history.forEach(h => {
      if (h.feedback) {
        const feedback = h.feedback.toLowerCase();
        const suggestionMatch = feedback.match(/suggestion[s]?[:\-]\s*([^.!?]+)/i);
        if (suggestionMatch) {
          const tip = suggestionMatch[1].trim();
          if (tip.length > 10 && tip.length < 150) {
            tips.push(tip.charAt(0).toUpperCase() + tip.slice(1));
          }
        }
      }
    });

    const uniqueTips = [...new Set(tips)].slice(0, 5);

    res.json({ 
      averageStress, 
      emotionCounts, 
      stressHistory,
      latestEmotion,
      latestEmotionTime,
      weeklyCount,
      weeklyAverageStress, 
      totalCount: history.length,
      mostCommonEmotion,
      mostCommonStressLevel,
      tips: uniqueTips
    });
  } catch (error) {
    console.error("Error fetching dashboard summary:", error);
    res.status(500).json({ error: "Failed to fetch dashboard summary" });
  }
});