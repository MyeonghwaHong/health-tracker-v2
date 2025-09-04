import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Check, X, TrendingUp, Droplets, Utensils, Scale, ChevronLeft, ChevronRight, Camera, Clock, User, LogOut, Save, Download } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const API_BASE = 'http://localhost:5000/api';

const HealthTrackerApp = () => {
  // 인증 상태
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // 로그인/회원가입 폼 상태
  const [authMode, setAuthMode] = useState('login');
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [authError, setAuthError] = useState('');

  // 기존 상태들
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [healthData, setHealthData] = useState({});
  const [activeModal, setActiveModal] = useState(null);
  const [tempData, setTempData] = useState('');
  const [tempTime, setTempTime] = useState('');
  const [tempPhoto, setTempPhoto] = useState(null);
  const [weightChartData, setWeightChartData] = useState([]);

  // API 호출 헬퍼 함수
  const apiCall = async (endpoint, options = {}) => {
    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        ...options,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'API 호출 실패');
      }
      
      return await response.json();
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  };

  // 인증 상태 확인
  const checkAuth = async () => {
    try {
      const result = await apiCall('/check-auth');
      if (result.authenticated) {
        setIsAuthenticated(true);
        setCurrentUser(result.user);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // 앱 초기화
  useEffect(() => {
    checkAuth();
  }, []);

  // 선택된 날짜의 건강 데이터 로드
  const loadHealthData = async (date) => {
    try {
      const data = await apiCall(`/health-data/${date}`);
      setHealthData(prev => ({
        ...prev,
        [date]: data
      }));
    } catch (error) {
      console.error('Failed to load health data:', error);
    }
  };

  // 건강 데이터 저장
  const saveHealthDataCategory = async (date, category, data) => {
    try {
      await apiCall(`/health-data/${date}/${category}`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
    } catch (error) {
      console.error('Failed to save health data:', error);
    }
  };

  // 체중 차트 데이터 로드
  const loadWeightChartData = async () => {
    try {
      const data = await apiCall('/health-data/weight-chart');
      setWeightChartData(data.map(item => ({
        date: new Date(item.date).toLocaleDateString('ko-KR', {
          month: 'short',
          day: 'numeric'
        }),
        weight: item.weight
      })));
    } catch (error) {
      console.error('Failed to load weight chart data:', error);
    }
  };

  // 선택된 날짜 변경 시 데이터 로드
  useEffect(() => {
    if (isAuthenticated && selectedDate) {
      loadHealthData(selectedDate);
    }
  }, [isAuthenticated, selectedDate]);

  // 인증된 상태일 때 체중 차트 데이터 로드
  useEffect(() => {
    if (isAuthenticated) {
      loadWeightChartData();
    }
  }, [isAuthenticated]);

  // 회원가입
  const handleRegister = async () => {
    const { name, email, password, confirmPassword } = registerForm;

    if (!name || !email || !password) {
      setAuthError('모든 필드를 입력해주세요.');
      return;
    }

    if (password !== confirmPassword) {
      setAuthError('비밀번호가 일치하지 않습니다.');
      return;
    }

    try {
      const result = await apiCall('/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password })
      });

      setCurrentUser(result.user);
      setIsAuthenticated(true);
      setAuthError('');
      setRegisterForm({ name: '', email: '', password: '', confirmPassword: '' });
    } catch (error) {
      setAuthError(error.message);
    }
  };

  // 로그인
  const handleLogin = async () => {
    const { email, password } = loginForm;

    if (!email || !password) {
      setAuthError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    try {
      const result = await apiCall('/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });

      setCurrentUser(result.user);
      setIsAuthenticated(true);
      setAuthError('');
      setLoginForm({ email: '', password: '' });
    } catch (error) {
      setAuthError(error.message);
    }
  };

  // 로그아웃
  const handleLogout = async () => {
    try {
      await apiCall('/logout', { method: 'POST' });
      setIsAuthenticated(false);
      setCurrentUser(null);
      setHealthData({});
      setWeightChartData([]);
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  // 데이터 내보내기
  const exportData = async () => {
    try {
      const data = await apiCall('/health-data/export');
      
      const dataStr = JSON.stringify(data, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `health-data-${currentUser.email}-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
      alert('데이터 내보내기에 실패했습니다.');
    }
  };

  // 데이터 가져오기
  const importData = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        
        await apiCall('/health-data/import', {
          method: 'POST',
          body: JSON.stringify(importedData)
        });

        // 현재 선택된 날짜의 데이터 다시 로드
        await loadHealthData(selectedDate);
        await loadWeightChartData();
        
        alert('데이터를 성공적으로 가져왔습니다!');
      } catch (error) {
        console.error('Import failed:', error);
        alert('데이터 가져오기에 실패했습니다.');
      }
    };
    reader.readAsText(file);
  };

  // 헬퍼 함수들
  const getLocalDateString = (date) => {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const day = d.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const formatDate = (date) => {
    const d = new Date(date);
    return d.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }

    return days;
  };

  const changeMonth = (direction) => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(prev.getMonth() + direction);
      return newDate;
    });
  };

  const selectDate = (date) => {
    const dateStr = getLocalDateString(date);
    setSelectedDate(dateStr);
  };

  // 현재 데이터 가져오기
  const currentData = healthData[selectedDate] || {
    water: {
      count: 8,
      targetAmount: 2000,
      records: Array(8).fill({ amount: '', completed: false, time: '' })
    },
    meals: {
      count: 4,
      labels: ['아침', '점심', '간식', '저녁'],
      records: Array(4).fill({ food: '', completed: false, time: '', photo: null })
    },
    exercise: { type: '', duration: '', completed: false },
    weight: ''
  };

  // 데이터 업데이트 함수들
  const updateWaterSettings = async (count, targetAmount) => {
    const newRecords = Array(count).fill({ amount: '', completed: false, time: '' });
    if (currentData.water && currentData.water.records) {
      currentData.water.records.forEach((record, index) => {
        if (index < count) {
          newRecords[index] = record;
        }
      });
    }

    const updatedWaterData = {
      count,
      targetAmount,
      records: newRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        water: updatedWaterData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'water', updatedWaterData);
  };

  const updateWater = async (index, amount) => {
    const updatedRecords = currentData.water.records.map((item, i) =>
      i === index ? { ...item, amount } : item
    );

    const updatedWaterData = {
      ...currentData.water,
      records: updatedRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        water: updatedWaterData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'water', updatedWaterData);
  };

  const toggleWaterComplete = async (index) => {
    const currentTime = new Date().toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit'
    });

    const updatedRecords = currentData.water.records.map((item, i) =>
      i === index ? {
        ...item,
        completed: !item.completed,
        time: !item.completed ? currentTime : ''
      } : item
    );

    const updatedWaterData = {
      ...currentData.water,
      records: updatedRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        water: updatedWaterData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'water', updatedWaterData);
  };

  const getWaterProgress = () => {
    const waterData = currentData.water;
    if (!waterData) return { current: 0, target: 2000, percentage: 0 };

    const current = waterData.records
      .filter(record => record.completed && record.amount)
      .reduce((sum, record) => {
        const amount = parseFloat(record.amount.replace(/[^0-9.]/g, '')) || 0;
        return sum + amount;
      }, 0);

    const percentage = Math.min((current / waterData.targetAmount) * 100, 100);

    return {
      current: Math.round(current),
      target: waterData.targetAmount,
      percentage: Math.round(percentage)
    };
  };

  const updateMealSettings = async (count, labels) => {
    const newRecords = Array(count).fill({ food: '', completed: false, time: '', photo: null });
    if (currentData.meals && currentData.meals.records) {
      currentData.meals.records.forEach((record, index) => {
        if (index < count) {
          newRecords[index] = record;
        }
      });
    }

    const updatedMealsData = {
      count,
      labels: labels.slice(0, count),
      records: newRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        meals: updatedMealsData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'meals', updatedMealsData);
  };

  const updateMeal = async (index, food, time, photo) => {
    const updatedRecords = currentData.meals.records.map((item, i) =>
      i === index ? { ...item, food, time: time || item.time, photo: photo !== undefined ? photo : item.photo } : item
    );

    const updatedMealsData = {
      ...currentData.meals,
      records: updatedRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        meals: updatedMealsData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'meals', updatedMealsData);
  };

  const toggleMealComplete = async (index) => {
    const updatedRecords = currentData.meals.records.map((item, i) =>
      i === index ? { ...item, completed: !item.completed } : item
    );

    const updatedMealsData = {
      ...currentData.meals,
      records: updatedRecords
    };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        meals: updatedMealsData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'meals', updatedMealsData);
  };

  const updateWeight = async (weight) => {
    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        weight
      }
    }));

    await saveHealthDataCategory(selectedDate, 'weight', weight);
    await loadWeightChartData(); // 체중 차트 데이터 새로고침
  };

  const updateExercise = async (type, duration) => {
    const updatedExerciseData = { type, duration, completed: true };

    setHealthData(prev => ({
      ...prev,
      [selectedDate]: {
        ...prev[selectedDate],
        exercise: updatedExerciseData
      }
    }));

    await saveHealthDataCategory(selectedDate, 'exercise', updatedExerciseData);
  };

  // 모달 관련 함수들
  const openModal = (type, index = null) => {
    setActiveModal({ type, index });
    if (type === 'waterSettings') {
      const waterData = currentData.water;
      setTempData(`${waterData.count},${waterData.targetAmount}`);
    } else if (type === 'mealSettings') {
      const mealData = currentData.meals;
      setTempData(`${mealData.count},${mealData.labels.join(',')}`);
    } else if (type === 'meal' && index !== null) {
      const meal = currentData.meals.records[index];
      setTempData(meal.food || '');
      setTempTime(meal.time || '');
      setTempPhoto(meal.photo || null);
    } else {
      setTempData('');
      setTempTime('');
      setTempPhoto(null);
    }
  };

  const closeModal = () => {
    setActiveModal(null);
    setTempData('');
    setTempTime('');
    setTempPhoto(null);
  };

  const saveModalData = () => {
    const { type, index } = activeModal;

    switch (type) {
      case 'water':
        updateWater(index, tempData);
        break;
      case 'waterSettings':
        const [count, targetAmount] = tempData.split(',');
        updateWaterSettings(parseInt(count) || 8, parseInt(targetAmount) || 2000);
        break;
      case 'meal':
        updateMeal(index, tempData, tempTime, tempPhoto);
        break;
      case 'mealSettings':
        const parts = tempData.split(',');
        const mealCount = parseInt(parts[0]) || 4;
        const labels = parts.slice(1);
        updateMealSettings(mealCount, labels);
        break;
      case 'weight':
        updateWeight(tempData);
        break;
      case 'exercise':
        const [exerciseType, duration] = tempData.split(',');
        updateExercise(exerciseType && exerciseType.trim() || '', duration && duration.trim() || '');
        break;
      default:
        break;
    }

    closeModal();
  };

  const days = getDaysInMonth(currentDate);
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 로딩 중
  if (loading) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">로딩 중...</p>
        </div>
      </div>
    );
  }

  // 로그인이 안된 상태일 때 로그인/회원가입 화면
  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto bg-white min-h-screen flex items-center justify-center">
        <div className="w-full p-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-800 mb-2">건강관리</h1>
            <p className="text-gray-600">건강한 하루를 기록해보세요</p>
          </div>

          <div className="mb-6">
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setAuthMode('login')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === 'login'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                로그인
              </button>
              <button
                onClick={() => setAuthMode('register')}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                  authMode === 'register'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-500'
                }`}
              >
                회원가입
              </button>
            </div>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-100 border border-red-300 text-red-700 rounded-lg text-sm">
              {authError}
            </div>
          )}

          {authMode === 'login' ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={loginForm.email}
                  onChange={(e) => setLoginForm(prev => ({...prev, email: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="이메일을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({...prev, password: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <button
                onClick={handleLogin}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                로그인
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
                <input
                  type="text"
                  value={registerForm.name}
                  onChange={(e) => setRegisterForm(prev => ({...prev, name: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="이름을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                <input
                  type="email"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm(prev => ({...prev, email: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="이메일을 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
                <input
                  type="password"
                  value={registerForm.password}
                  onChange={(e) => setRegisterForm(prev => ({...prev, password: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                <input
                  type="password"
                  value={registerForm.confirmPassword}
                  onChange={(e) => setRegisterForm(prev => ({...prev, confirmPassword: e.target.value}))}
                  className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  placeholder="비밀번호를 다시 입력하세요"
                />
              </div>
              <button
                onClick={handleRegister}
                className="w-full py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                회원가입
              </button>
            </div>
          )}

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              {authMode === 'login' ?
                '계정이 없으신가요? 회원가입을 눌러주세요.' :
                '이미 계정이 있으신가요? 로그인을 눌러주세요.'
              }
            </p>
          </div>
        </div>
      </div>
    );
  }

  // 로그인된 상태 - 기존 건강관리 앱
  return (
    <div className="max-w-md mx-auto bg-white min-h-screen">
      {/* 헤더 */}
      <div className="bg-blue-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <User className="w-5 h-5 mr-2" />
            <div>
              <h1 className="text-lg font-bold">건강관리</h1>
              <p className="text-xs text-blue-100">{currentUser.name}님 환영합니다</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={exportData}
              title="데이터 내보내기"
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
            <label title="데이터 가져오기" className="p-2 hover:bg-blue-700 rounded-lg transition-colors cursor-pointer">
              <Save className="w-4 h-4" />
              <input
                type="file"
                accept=".json"
                onChange={importData}
                className="hidden"
              />
            </label>
            <button
              onClick={handleLogout}
              title="로그아웃"
              className="p-2 hover:bg-blue-700 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 달력 */}
      <div className="p-4 bg-gray-50">
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-2">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h2 className="text-lg font-semibold">
              {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
            </h2>
            <button onClick={() => changeMonth(1)} className="p-2">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div key={day} className="text-center text-sm font-medium text-gray-500 p-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => (
              <button
                key={index}
                onClick={() => day && selectDate(day)}
                className={`p-2 text-sm rounded ${
                  day
                    ? getLocalDateString(day) === selectedDate
                      ? 'bg-blue-600 text-white'
                      : 'hover:bg-gray-100'
                    : ''
                }`}
                disabled={!day}
              >
                {day ? day.getDate() : ''}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 선택된 날짜 */}
      <div className="px-4 py-2 bg-gray-100">
        <p className="text-sm text-gray-600">{formatDate(selectedDate)}</p>
      </div>

      {/* 대시보드 */}
      <div className="p-4 space-y-4">
        {/* 물 섭취 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Droplets className="w-5 h-5 text-blue-500 mr-2" />
              <h3 className="font-semibold">물 섭취</h3>
            </div>
            <button
              onClick={() => openModal('waterSettings')}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            >
              설정
            </button>
          </div>

          <div className={`grid gap-2 mb-4`} style={{ gridTemplateColumns: `repeat(${Math.min(currentData.water.count, 5)}, 1fr)` }}>
            {currentData.water.records.map((water, index) => (
              <div key={index} className="text-center">
                <button
                  onClick={() => openModal('water', index)}
                  className={`w-full p-2 text-xs border rounded mb-1 ${
                    water.completed
                      ? 'bg-blue-100 text-blue-600 opacity-60'
                      : 'border-gray-300 hover:border-blue-300'
                  }`}
                >
                  {water.amount || `${index + 1}번`}
                </button>
                {water.amount && (
                  <button
                    onClick={() => toggleWaterComplete(index)}
                    className={`w-full text-xs p-1 rounded ${
                      water.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {water.completed ? `완료 ${water.time}` : '완료'}
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* 물 섭취 진행률 */}
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-gray-600">진행률</span>
              <span className="text-sm font-medium">
                {getWaterProgress().current}ml / {getWaterProgress().target}ml ({getWaterProgress().percentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${getWaterProgress().percentage}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* 식사 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Utensils className="w-5 h-5 text-orange-500 mr-2" />
              <h3 className="font-semibold">식사</h3>
            </div>
            <button
              onClick={() => openModal('mealSettings')}
              className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
            >
              설정
            </button>
          </div>
          <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(currentData.meals.count, 4)}, 1fr)` }}>
            {currentData.meals.records.map((meal, index) => (
              <div key={index} className="text-center">
                <div className="mb-2">
                  <span className="text-xs text-gray-500 font-medium">
                    {currentData.meals.labels[index] || `${index + 1}끼`}
                  </span>
                </div>

                {meal.photo && (
                  <div className="mb-2">
                    <img
                      src={meal.photo}
                      alt="식사 사진"
                      className="w-full h-16 object-cover rounded border"
                    />
                  </div>
                )}

                <button
                  onClick={() => openModal('meal', index)}
                  className={`w-full p-2 text-xs border rounded mb-1 ${
                    meal.completed
                      ? 'bg-orange-100 text-orange-600 opacity-60'
                      : 'border-gray-300 hover:border-orange-300'
                  }`}
                >
                  {meal.food || '메뉴 입력'}
                </button>

                {meal.time && (
                  <div className="text-xs text-gray-500 mb-1">
                    {meal.time}
                  </div>
                )}

                {meal.food && (
                  <button
                    onClick={() => toggleMealComplete(index)}
                    className={`w-full text-xs p-1 rounded ${
                      meal.completed
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {meal.completed ? '완료' : '완료'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 운동 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <TrendingUp className="w-5 h-5 text-green-500 mr-2" />
              <h3 className="font-semibold">운동</h3>
            </div>
            <button
              onClick={() => openModal('exercise')}
              className="p-1 text-blue-500 hover:bg-blue-50 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="text-sm text-gray-600">
            {currentData.exercise.type ? (
              <p>{currentData.exercise.type} - {currentData.exercise.duration}</p>
            ) : (
              <p>운동 기록이 없습니다</p>
            )}
          </div>
        </div>

        {/* 공복 체중 */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <Scale className="w-5 h-5 text-purple-500 mr-2" />
              <h3 className="font-semibold">공복 체중</h3>
            </div>
            <button
              onClick={() => openModal('weight')}
              className="p-1 text-blue-500 hover:bg-blue-50 rounded"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="mb-3">
            <p className="text-sm text-gray-600">
              오늘: {currentData.weight ? `${currentData.weight}kg` : '기록 없음'}
            </p>
          </div>

          {weightChartData.length > 0 && (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis domain={['dataMin - 5', 'dataMax + 5']} />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="weight"
                    stroke="#8884d8"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* 모달 */}
      {activeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-sm">
            <h3 className="text-lg font-semibold mb-4">
              {activeModal.type === 'water' && `물 섭취 ${activeModal.index + 1}번`}
              {activeModal.type === 'waterSettings' && '물 섭취 설정'}
              {activeModal.type === 'meal' && `${currentData.meals.labels[activeModal.index] || '식사'} 기록`}
              {activeModal.type === 'mealSettings' && '식사 설정'}
              {activeModal.type === 'weight' && `공복 체중 (${formatDate(selectedDate)})`}
              {activeModal.type === 'exercise' && '운동'}
            </h3>

            {activeModal.type === 'waterSettings' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    물 섭취 횟수
                  </label>
                  <input
                    type="number"
                    value={tempData.split(',')[0] || ''}
                    onChange={(e) => setTempData(`${e.target.value},${tempData.split(',')[1] || '2000'}`)}
                    min="1"
                    max="20"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    목표 총량 (ml)
                  </label>
                  <input
                    type="number"
                    value={tempData.split(',')[1] || ''}
                    onChange={(e) => setTempData(`${tempData.split(',')[0] || '8'},${e.target.value}`)}
                    min="500"
                    max="5000"
                    step="100"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            ) : activeModal.type === 'mealSettings' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    식사 횟수
                  </label>
                  <input
                    type="number"
                    value={tempData.split(',')[0] || ''}
                    onChange={(e) => {
                      const count = parseInt(e.target.value) || 4;
                      const defaultLabels = ['아침', '점심', '간식', '저녁', '야식', '간식2'];
                      const labels = defaultLabels.slice(0, count);
                      setTempData(`${count},${labels.join(',')}`);
                    }}
                    min="1"
                    max="8"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    식사 이름 (쉼표로 구분)
                  </label>
                  <input
                    type="text"
                    value={tempData.split(',').slice(1).join(',') || ''}
                    onChange={(e) => setTempData(`${tempData.split(',')[0] || '4'},${e.target.value}`)}
                    placeholder="아침,점심,간식,저녁"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            ) : activeModal.type === 'meal' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    음식
                  </label>
                  <input
                    type="text"
                    value={tempData}
                    onChange={(e) => setTempData(e.target.value)}
                    placeholder="음식 종류 (예: 샐러드, 파스타)"
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    시간
                  </label>
                  <input
                    type="time"
                    value={tempTime}
                    onChange={(e) => setTempTime(e.target.value)}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    <Camera className="w-4 h-4 inline mr-1" />
                    사진
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (event) => {
                          setTempPhoto(event.target.result);
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="w-full p-3 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
                  />
                  {tempPhoto && (
                    <div className="mt-2">
                      <img
                        src={tempPhoto}
                        alt="미리보기"
                        className="w-full h-32 object-cover rounded border"
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <input
                type="text"
                value={tempData}
                onChange={(e) => setTempData(e.target.value)}
                placeholder={
                  activeModal.type === 'water' ? '물의 양 (예: 500ml)' :
                  activeModal.type === 'weight' ? '체중 (예: 70.5)' :
                  '운동 종류, 시간 (예: 런닝, 30분)'
                }
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            )}

            <div className="flex space-x-3">
              <button
                onClick={closeModal}
                className="flex-1 p-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                취소
              </button>
              <button
                onClick={saveModalData}
                className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default HealthTrackerApp;